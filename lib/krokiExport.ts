// Krokiyi (etkinlik alanı yerleşim planını) admin panelinden "belge olarak
// gönder" özelliği için basılabilir bir HTML sayfasına dönüştüren saf
// fonksiyon. Üretilen HTML, expo-print ile PDF'e çevrilip cihazın paylaşım
// menüsünden gönderiliyor (bkz. AdminMapManagement.tsx > handleExportKroki).
//
// Kroki artık bir fotoğraf DEĞİL — admin'in tamamen kendi çizdiği (duvar
// çizgileri) bir vektör plan. Bu yüzden PDF'te de aynı planı bir SVG olarak
// çiziyoruz: beyaz zemin üzerinde admin'in çizdiği duvarlar + stant/oturum
// yeri pinleri, uygulama içindeki görünümle birebir aynı yüzde
// koordinatlarında.

import { isBoothPlaced } from './boothGrid';
import { ENTRANCE_GATE_COLOR, ENTRANCE_GATE_LABEL, ENTRANCE_GATE_LINE, FLOOR_PLAN_ASPECT_RATIO } from './floorPlanGrid';
import type { AdminBooth, AdminStage, FloorPlanWall, ZoneDensityInfo } from '../types/admin';

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildKrokiSection(zones: ZoneDensityInfo[], booths: AdminBooth[], stages: AdminStage[], walls: FloorPlanWall[]) {
  const placedBooths = booths.filter(isBoothPlaced);

  const boothPins = placedBooths
    .map((booth) => {
      const zoneInfo = zones.find((zone) => zone.code === booth.zone);
      return `<div class="pin booth-pin" style="left:${booth.mapX}%;top:${booth.mapY}%;">
        <span class="pin-dot" style="background:${zoneInfo?.color || '#2563eb'}"></span>
        <span class="pin-label">${escapeHtml(booth.boothNo)}</span>
      </div>`;
    })
    .join('');

  const stagePins = stages
    .map(
      (stage) => `<div class="pin stage-pin" style="left:${stage.mapX}%;top:${stage.mapY}%;">
        <span class="pin-dot stage-dot"></span>
        <span class="pin-label stage-label">${escapeHtml(stage.name)}</span>
      </div>`,
    )
    .join('');

  // Admin'in elle çizdiği duvar çizgileri — rota bulma bunları engel sayıp
  // etraflarından dolanıyor (bkz. lib/routePlanner.ts), PDF'te de aynı
  // çizgiler gösterilerek kroki uygulama içindeki görünümle tutarlı kalıyor.
  const wallLines = walls
    .map((wall) => `<line x1="${wall.x1}" y1="${wall.y1}" x2="${wall.x2}" y2="${wall.y2}" />`)
    .join('');

  // Sabit "giriş kapısı" işareti — admin ve katılımcı ekranlarındaki (bkz.
  // AdminMapManagement.tsx, app/(tabs)/map.tsx) yeşil çizgiyle birebir aynı
  // sabit koordinat (lib/floorPlanGrid.ts > ENTRANCE_GATE_LINE), PDF'te de
  // tutarlılık için gösteriliyor.
  const entranceLine = `<line x1="${ENTRANCE_GATE_LINE.x1}" y1="${ENTRANCE_GATE_LINE.y1}" x2="${ENTRANCE_GATE_LINE.x2}" y2="${ENTRANCE_GATE_LINE.y2}" stroke="${ENTRANCE_GATE_COLOR}" stroke-width="2.2" stroke-linecap="round" />`;

  return `
    <section class="kroki-wrap">
      <svg class="kroki-canvas" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="0" y="0" width="100" height="100" fill="#ffffff" />
        ${wallLines ? `<g class="wall-overlay">${wallLines}</g>` : ''}
        ${entranceLine}
      </svg>
      ${boothPins}
      ${stagePins}
    </section>
    <div class="legend-line">
      <span class="legend-item"><span class="pin-dot" style="background:#2563eb"></span> Stant</span>
      <span class="legend-item"><span class="pin-dot stage-dot"></span> Sahne / Oturum Yeri</span>
      ${walls.length ? '<span class="legend-item"><span class="legend-wall"></span> Duvar</span>' : ''}
      <span class="legend-item"><span class="legend-entrance"></span> ${ENTRANCE_GATE_LABEL === 'GİRİŞ' ? 'Giriş Kapısı' : ENTRANCE_GATE_LABEL}</span>
    </div>
  `;
}

export function buildKrokiHtml(
  zones: ZoneDensityInfo[],
  booths: AdminBooth[],
  stages: AdminStage[] = [],
  eventName = 'Take Off',
  walls: FloorPlanWall[] = [],
) {
  const generatedAt = new Date().toLocaleString('tr-TR');
  const placed = booths.filter(isBoothPlaced);

  const bodySection = buildKrokiSection(zones, booths, stages, walls);

  const indexRows = placed
    .slice()
    .sort((a, b) => a.boothNo.localeCompare(b.boothNo, 'tr'))
    .map(
      (booth) =>
        `<tr><td>${escapeHtml(booth.boothNo)}</td><td>${escapeHtml(booth.companyName)}</td><td>${escapeHtml(booth.category)}</td><td>${escapeHtml(booth.zone)}</td></tr>`,
    )
    .join('');

  return `<!doctype html>
  <html lang="tr">
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0f172a; padding: 28px; }
        h1 { font-size: 20px; margin: 0 0 2px 0; }
        .subtitle { color: #64748b; font-size: 11px; margin-bottom: 22px; }
        .kroki-wrap { position: relative; width: 100%; aspect-ratio: ${FLOOR_PLAN_ASPECT_RATIO}; margin-bottom: 14px; page-break-inside: avoid; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; }
        .kroki-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
        .wall-overlay line { stroke: #dc2626; stroke-width: 1.6; stroke-linecap: round; }
        .pin { position: absolute; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 3px; }
        .pin-dot { width: 9px; height: 9px; border-radius: 5px; border: 1.5px solid white; box-shadow: 0 0 0 1px rgba(0,0,0,0.25); flex-shrink: 0; }
        .stage-dot { background: #f59e0b; }
        .pin-label { font-size: 8px; font-weight: 700; color: #0f172a; background: rgba(255,255,255,0.92); padding: 1px 4px; border-radius: 4px; white-space: nowrap; }
        .stage-label { color: #92400e; }
        .legend-line { display: flex; gap: 16px; margin-bottom: 18px; }
        .legend-item { display: flex; align-items: center; gap: 5px; font-size: 10px; color: #475569; }
        .legend-wall { display: inline-block; width: 12px; height: 2px; background: #dc2626; border-radius: 2px; }
        .legend-entrance { display: inline-block; width: 12px; height: 2px; background: #16a34a; border-radius: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
        th, td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 5px 6px; }
        th { color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.03em; }
        h2.index-title { font-size: 13px; margin: 22px 0 4px 0; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(eventName)} — Etkinlik Krokisi</h1>
      <div class="subtitle">Oluşturulma: ${escapeHtml(generatedAt)} · ${placed.length} stant yerleştirildi</div>
      ${bodySection}
      <h2 class="index-title">Stant Dizini</h2>
      <table>
        <thead><tr><th>No</th><th>Firma</th><th>Kategori</th><th>Bölge</th></tr></thead>
        <tbody>${indexRows || '<tr><td colspan="4">Henüz stant yerleştirilmedi.</td></tr>'}</tbody>
      </table>
    </body>
  </html>`;
}
