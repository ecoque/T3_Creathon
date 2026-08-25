// Krokide iki nokta (örn. A101 standı ile C203 standı) arasında, aradaki
// diğer stant/sahnelerin VE admin'in elle çizdiği duvarların etrafından
// dolanan bir yürüyüş rotası hesaplayan saf fonksiyonlar. Hiçbir
// React/Supabase bağımlılığı yok — hem katılımcı haritasından
// (app/(tabs)/map.tsx) hem de ileride başka bir ekrandan güvenle
// kullanılabilir.
//
// Yaklaşım: kroki, yüzde (0-100) uzayında ince bir ızgaraya bölünüyor. İki
// tür engel var:
//   - "circle": bir stant/sahnenin konumunun etrafındaki dairesel alan
//     (kendi ayak izini kabaca temsil eden bir yarıçapla).
//   - "wall": admin'in krokiye elle çizdiği bir duvar çizgisi (iki uç
//     nokta + kalınlık). Her kroki fotoğrafı farklı olduğu için duvarlar
//     otomatik tespit edilmiyor — admin krokiyi yükledikten sonra bir kere
//     elle işaretliyor (bkz. AdminMapManagement.tsx > duvar çizme modu,
//     types/admin.ts > FloorPlanWall).
// Başlangıç ve bitiş hücreleri arasında A* ile en kısa yol aranıyor
// (8 yönlü hareket, köşeden kesmeyi engelleyen kontrol dahil), sonra
// bulunan ızgara yolu "görüş hattı" sadeleştirmesiyle gereksiz zikzaklardan
// arındırılıp doğal, az köşeli bir çizgiye dönüştürülüyor.

export type RoutePoint = { x: number; y: number };

export type RouteCircleObstacle = {
  kind: 'circle';
  id: string;
  x: number;
  y: number;
  radius: number;
};

export type RouteWallObstacle = {
  kind: 'wall';
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  // Duvarın "kalınlığı" — rota bu çizginin her iki yanından da en az
  // thickness/2 kadar uzakta kalacak şekilde çizilir.
  thickness: number;
};

export type RouteObstacle = RouteCircleObstacle | RouteWallObstacle;

// Admin bir duvar çizerken kalınlık belirtmiyor, hep bu sabit kullanılıyor
// — ince bir bölme duvarını gerçekçi biçimde temsil eden makul bir değer.
export const DEFAULT_WALL_THICKNESS = 2;

// Rota, engellerin (stant/sahne/duvar) TAM kenarına yapışık çizilmesin diye
// eklenen ekstra pay — kullanıcının "duvarın dibinden ani dönüşler oluyor"
// şikayetinin kök nedeni buydu: yol, engelin gerçek sınırına kadar sıkışık
// gidip TAM o noktada keskin bir açıyla dönüyordu. Bu pay, yolu engellerden
// biraz daha uzakta tutarak hem daha doğal görünmesini sağlıyor hem de
// aşağıdaki köşe yuvarlama işlemine (bkz. roundCorners) güvenli bir alan
// bırakıyor. Varsayılan ızgara hücresi ~1.1-1.7 birim olduğu için 1.4 birim
// yaklaşık bir hücrelik ek boşluk demek — çok dar geçitleri tıkayacak kadar
// büyük değil.
export const DEFAULT_ROUTE_CLEARANCE = 1.4;

function inflateObstacle(obstacle: RouteObstacle, clearance: number): RouteObstacle {
  if (clearance <= 0) return obstacle;
  if (obstacle.kind === 'circle') {
    return { ...obstacle, radius: obstacle.radius + clearance };
  }
  return { ...obstacle, thickness: obstacle.thickness + clearance * 2 };
}

const DEFAULT_COLS = 90;
const DEFAULT_ROWS = 60;

const NEIGHBORS8: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distanceToSegmentSquared(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  let t = lenSq === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
}

// İki doğru parçasının (a1-a2 ve b1-b2) kesişip kesişmediğini standart
// yönelim (orientation) testiyle bulur — çakışık/dokunan uç noktaları da
// kesişme sayar.
function segmentsIntersect(
  ax1: number,
  ay1: number,
  ax2: number,
  ay2: number,
  bx1: number,
  by1: number,
  bx2: number,
  by2: number,
) {
  function orientation(ox: number, oy: number, px: number, py: number, qx: number, qy: number) {
    const val = (py - oy) * (qx - px) - (px - ox) * (qy - py);
    if (Math.abs(val) < 1e-9) return 0;
    return val > 0 ? 1 : 2;
  }
  function onSegment(sx: number, sy: number, ex: number, ey: number, px: number, py: number) {
    return (
      Math.min(sx, ex) - 1e-9 <= px &&
      px <= Math.max(sx, ex) + 1e-9 &&
      Math.min(sy, ey) - 1e-9 <= py &&
      py <= Math.max(sy, ey) + 1e-9
    );
  }
  const o1 = orientation(ax1, ay1, ax2, ay2, bx1, by1);
  const o2 = orientation(ax1, ay1, ax2, ay2, bx2, by2);
  const o3 = orientation(bx1, by1, bx2, by2, ax1, ay1);
  const o4 = orientation(bx1, by1, bx2, by2, ax2, ay2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(ax1, ay1, ax2, ay2, bx1, by1)) return true;
  if (o2 === 0 && onSegment(ax1, ay1, ax2, ay2, bx2, by2)) return true;
  if (o3 === 0 && onSegment(bx1, by1, bx2, by2, ax1, ay1)) return true;
  if (o4 === 0 && onSegment(bx1, by1, bx2, by2, ax2, ay2)) return true;
  return false;
}

// İki doğru parçası arasındaki en kısa mesafe (kesişiyorlarsa 0).
function segmentToSegmentDistance(
  ax1: number,
  ay1: number,
  ax2: number,
  ay2: number,
  bx1: number,
  by1: number,
  bx2: number,
  by2: number,
) {
  if (segmentsIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2)) return 0;
  return Math.sqrt(
    Math.min(
      distanceToSegmentSquared(ax1, ay1, bx1, by1, bx2, by2),
      distanceToSegmentSquared(ax2, ay2, bx1, by1, bx2, by2),
      distanceToSegmentSquared(bx1, by1, ax1, ay1, ax2, ay2),
      distanceToSegmentSquared(bx2, by2, ax1, ay1, ax2, ay2),
    ),
  );
}

function buildBlockedGrid(cols: number, rows: number, obstacles: RouteObstacle[]) {
  const blocked = new Uint8Array(cols * rows);
  if (!obstacles.length) return blocked;
  const cellW = 100 / cols;
  const cellH = 100 / rows;
  for (let gy = 0; gy < rows; gy++) {
    const cy = (gy + 0.5) * cellH;
    for (let gx = 0; gx < cols; gx++) {
      const cx = (gx + 0.5) * cellW;
      for (const obstacle of obstacles) {
        if (obstacle.kind === 'circle') {
          const dx = cx - obstacle.x;
          const dy = cy - obstacle.y;
          if (dx * dx + dy * dy <= obstacle.radius * obstacle.radius) {
            blocked[gy * cols + gx] = 1;
            break;
          }
        } else {
          const distSq = distanceToSegmentSquared(cx, cy, obstacle.x1, obstacle.y1, obstacle.x2, obstacle.y2);
          const half = obstacle.thickness / 2;
          if (distSq <= half * half) {
            blocked[gy * cols + gx] = 1;
            break;
          }
        }
      }
    }
  }
  return blocked;
}

// Başlangıç/bitiş tam olarak bir engelin merkezinde olduğu için (kendi
// standının/sahnesinin konumu), o hücre ve hemen komşuları her zaman
// yürünebilir kabul edilir — yoksa admin çok yakın iki stant koyduğunda
// biri diğerinin "içinde" kalıp rota hiç bulunamayabilir.
function clearCellAndNeighbors(blocked: Uint8Array, cols: number, rows: number, cx: number, cy: number) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      blocked[y * cols + x] = 0;
    }
  }
}

function heuristic(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

function findGridPath(
  cols: number,
  rows: number,
  blocked: Uint8Array,
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const size = cols * rows;
  const idx = (x: number, y: number) => y * cols + x;
  const startIdx = idx(start.x, start.y);
  const endIdx = idx(end.x, end.y);
  if (startIdx === endIdx) return [start];

  const gScore = new Float64Array(size).fill(Infinity);
  const fScore = new Float64Array(size).fill(Infinity);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const inOpen = new Uint8Array(size);
  const open: number[] = [startIdx];
  inOpen[startIdx] = 1;
  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(start.x, start.y, end.x, end.y);

  while (open.length) {
    // Küçük ızgara (varsayılan 90x60) için doğrusal min arama yeterince
    // hızlı — ayrı bir öncelik kuyruğu yapısına gerek yok.
    let bestPos = 0;
    let bestScore = fScore[open[0]];
    for (let i = 1; i < open.length; i++) {
      if (fScore[open[i]] < bestScore) {
        bestScore = fScore[open[i]];
        bestPos = i;
      }
    }
    const current = open[bestPos];
    if (current === endIdx) {
      const path: { x: number; y: number }[] = [];
      let node = current;
      while (node !== -1) {
        path.push({ x: node % cols, y: Math.floor(node / cols) });
        node = cameFrom[node];
      }
      return path.reverse();
    }
    open[bestPos] = open[open.length - 1];
    open.pop();
    inOpen[current] = 0;
    closed[current] = 1;

    const cx = current % cols;
    const cy = Math.floor(current / cols);
    for (const [dx, dy] of NEIGHBORS8) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const nIdx = idx(nx, ny);
      if (closed[nIdx] || blocked[nIdx]) continue;
      // Çapraz hareket ederken iki blok köşe arasından "kesmeyi" engelle —
      // yoksa yol görsel olarak bir stant köşesinin veya duvarın üzerinden
      // geçebilir.
      if (dx !== 0 && dy !== 0) {
        if (blocked[idx(cx + dx, cy)] || blocked[idx(cx, cy + dy)]) continue;
      }
      const stepCost = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1;
      const tentativeG = gScore[current] + stepCost;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + heuristic(nx, ny, end.x, end.y);
        if (!inOpen[nIdx]) {
          open.push(nIdx);
          inOpen[nIdx] = 1;
        }
      }
    }
  }
  return null;
}

function hasLineOfSight(a: RoutePoint, b: RoutePoint, obstacles: RouteObstacle[]) {
  return obstacles.every((obstacle) => {
    if (obstacle.kind === 'circle') {
      return distanceToSegmentSquared(obstacle.x, obstacle.y, a.x, a.y, b.x, b.y) > obstacle.radius * obstacle.radius;
    }
    const distance = segmentToSegmentDistance(
      a.x,
      a.y,
      b.x,
      b.y,
      obstacle.x1,
      obstacle.y1,
      obstacle.x2,
      obstacle.y2,
    );
    return distance > obstacle.thickness / 2;
  });
}

// Izgara yolundaki gereksiz ara noktaları, aralarında engelsiz bir görüş
// hattı olduğu sürece atlayarak daha az köşeli, daha doğal görünen bir
// çizgi üretir (basit bir "string pulling" sadeleştirmesi).
function simplifyPath(points: RoutePoint[], obstacles: RouteObstacle[]) {
  if (points.length <= 2) return points;
  const result: RoutePoint[] = [points[0]];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let farthest = anchor + 1;
    for (let candidate = anchor + 2; candidate < points.length; candidate++) {
      if (hasLineOfSight(points[anchor], points[candidate], obstacles)) {
        farthest = candidate;
      } else {
        break;
      }
    }
    result.push(points[farthest]);
    anchor = farthest;
  }
  return result;
}

// Her köşede kesilen kenar oranı (0-0.5 arası) — 0.28, art arda gelen iki
// köşe aynı kenarı paylaşsa bile (kesim < 0.5 olduğu sürece) kesimlerin
// birbirine çakışmayacağını garanti eden güvenli bir değer.
const CORNER_CUT_RATIO = 0.28;
// Her köşedeki kavis için örneklenen ara nokta sayısı — ne kadar fazlaysa
// çizgi o kadar pürüzsüz görünür, SVG Polyline için 6 nokta yeterince
// yumuşak bir görünüm veriyor.
const CORNER_SAMPLES = 6;

function lerp(a: RoutePoint, b: RoutePoint, t: number): RoutePoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function quadraticBezier(p0: RoutePoint, p1: RoutePoint, p2: RoutePoint, t: number): RoutePoint {
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  return lerp(a, b, t);
}

// simplifyPath'ten gelen köşeli çizgiyi, her ara noktada (başlangıç/bitiş
// hariç) kenarların bir kısmını kesip yerine kuadratik bir Bezier kavisi
// yerleştirerek yumuşatır — "duvarın dibinden ani dönüş" hissini ortadan
// kaldırıp daha doğal, insan yürüyüşüne benzer bir çizgi üretir. Sadece
// GÖRSEL bir son işlem: hangi hücrelerden geçileceğine dair karar zaten
// verilmiş durumda, bu fonksiyon sadece o kararı daha yumuşak bir eğriye
// çeviriyor. Çok kısa kenarlarda kesim oranı orantılı küçüldüğü için
// (fraction sabit kalsa da mesafe kısaldığı için) dejenere/aşırı kıvrımlı
// bir sonuç oluşmaz.
function roundCorners(points: RoutePoint[]): RoutePoint[] {
  if (points.length <= 2) return points;
  const result: RoutePoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const enter = lerp(prev, curr, 1 - CORNER_CUT_RATIO);
    const exit = lerp(curr, next, CORNER_CUT_RATIO);
    result.push(enter);
    for (let s = 1; s < CORNER_SAMPLES; s++) {
      result.push(quadraticBezier(enter, curr, exit, s / CORNER_SAMPLES));
    }
    result.push(exit);
  }
  result.push(points[points.length - 1]);
  return result;
}

// Başlangıç ile bitiş arasında, verilen engellerin (stant/sahne/duvar)
// etrafından dolanan bir rota bulur. Rota yoksa (örn. tamamen kapalı bir
// alan) null döner. Dönen noktalar krokideki yüzde (0-100) koordinat
// sisteminde.
export function findRoute(
  start: RoutePoint,
  end: RoutePoint,
  obstacles: RouteObstacle[],
  options?: { cols?: number; rows?: number; clearance?: number },
): RoutePoint[] | null {
  const cols = options?.cols ?? DEFAULT_COLS;
  const rows = options?.rows ?? DEFAULT_ROWS;
  const clearance = options?.clearance ?? DEFAULT_ROUTE_CLEARANCE;

  const toCell = (point: RoutePoint) => ({
    x: clampInt(Math.floor((point.x / 100) * cols), 0, cols - 1),
    y: clampInt(Math.floor((point.y / 100) * rows), 0, rows - 1),
  });
  const startCell = toCell(start);
  const endCell = toCell(end);
  const cellW = 100 / cols;
  const cellH = 100 / rows;

  // Belirli bir engel listesiyle (orijinal ya da genişletilmiş/"inflated")
  // tam bir rota denemesi yapar. Izgara bloklama VE görüş-hattı sadeleştirmesi
  // AYNI engel listesini kullanmalı — yoksa sadeleştirme, ızgaranın kaçındığı
  // bir engele fazla yakın bir kestirmeyi "güvenli" sanabilir.
  function attempt(obstaclesForAttempt: RouteObstacle[]): RoutePoint[] | null {
    const blocked = buildBlockedGrid(cols, rows, obstaclesForAttempt);
    clearCellAndNeighbors(blocked, cols, rows, startCell.x, startCell.y);
    clearCellAndNeighbors(blocked, cols, rows, endCell.x, endCell.y);

    const gridPath = findGridPath(cols, rows, blocked, startCell, endCell);
    if (!gridPath) return null;

    const percentPath: RoutePoint[] = [
      start,
      ...gridPath.map((cell) => ({ x: (cell.x + 0.5) * cellW, y: (cell.y + 0.5) * cellH })),
      end,
    ];
    return simplifyPath(percentPath, obstaclesForAttempt);
  }

  // Önce engellere ekstra pay ekleyerek dene (daha doğal, duvara/stanta
  // yapışmayan bir rota) — eğer bu pay yüzünden dar bir geçit tamamen
  // kapanıp rota bulunamazsa (örn. iki stant arasındaki tek geçit), payı
  // hiç eklemeden orijinal engellerle tekrar dene. Böylece yumuşatma
  // özelliği var olan bir rotayı asla "rota bulunamadı"ya çeviremez.
  const inflated = clearance > 0 ? obstacles.map((o) => inflateObstacle(o, clearance)) : obstacles;
  const simplified = attempt(inflated) ?? (clearance > 0 ? attempt(obstacles) : null);
  if (!simplified) return null;

  return roundCorners(simplified);
}
