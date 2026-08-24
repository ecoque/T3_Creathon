// Krokiyi (etkinlik alanı yerleşim planını) admin panelinden "belge olarak
// gönder" özelliği için basılabilir bir HTML sayfasına dönüştüren saf
// fonksiyon. Üretilen HTML, expo-print ile PDF'e çevrilip cihazın paylaşım
// menüsünden gönderiliyor (bkz. AdminMapManagement.tsx > handleExportKroki).
//
// Admin gerçek bir kroki fotoğrafı yüklediyse (floorPlanUrl), o fotoğrafın
// üzerine stant ve oturum yeri etiketleri basılıyor — tıpkı uygulama
// içindeki görünüm gibi. Henüz fotoğraf yüklenmediyse, eskisi gibi soyut
// zone bazlı bir tabloya düşülüyor.

import { ZONE_LETTER, ZONE_ORDER, isBoothPlaced } from './boothGrid';
import type { AdminBooth, AdminStage, FloorPlanWall, ZoneDensityInfo } from '../types/admin';

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPhotoOverlaySection(
  floorPlanUrl: string,
  zones: ZoneDensityInfo[],
  booths: AdminBooth[],
  stages: AdminStage[],
  walls: FloorPlanWall[],
) {
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
  // çizgiler gösterilerek kroki her yerde tutarlı görünüyor.
  const wallLines = walls
    .map((wall) => `<line x1="${wall.x1}" y1="${wall.y1}" x2="${wall.x2}" y2="${wall.y2}" />`)
    .join('');
  const wallOverlay = walls.length
    ? `<svg class="wall-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">${wallLines}</svg>`
    : '';

  return `
    <section class="photo-wrap">
      <img class="photo" src="${floorPlanUrl}" />
      ${wallOverlay}
      ${boothPins}
      ${stagePins}
    </section>
    <div class="legend-line">
      <span class="legend-item"><span class="pin-dot" style="background:#2563eb"></span> Stant</span>
      <span class="legend-item"><span class="pin-dot stage-dot"></span> Sahne / Oturum Yeri</span>
      ${walls.length ? '<span class="legend-item"><span class="legend-wall"></span> Duvar</span>' : ''}
    </div>
  `;
}

// Henüz gerçek bir kroki fotoğrafı yüklenmediyse: her zone için basit bir
// stant listesi (artık kareli bir ızgara değil — kroki serbest yerleşimli).
function buildAbstractGridSection(zones: ZoneDensityInfo[], booths: AdminBooth[]) {
  const placed = booths.filter(isBoothPlaced);

  return ZONE_ORDER.map((code) => {
    const zoneInfo = zones.find((zone) => zone.code === code);
    const zoneBooths = placed.filter((booth) => booth.zone === code);
    const rows = zoneBooths.length
      ? zoneBooths
          .map(
            (booth) =>
              `<div class="zone-row"><span class="zone-row-no">${escapeHtml(booth.boothNo)}</span><span class="zone-row-name">${escapeHtml(booth.companyName)}</span></div>`,
          )
          .join('')
      : '<div class="zone-row zone-row-empty">Henüz stant yerleştirilmedi.</div>';

    return `
      <section class="zone">
        <div class="zone-header" style="border-color:${zoneInfo?.color || '#94a3b8'}">
          <span class="zone-dot" style="background:${zoneInfo?.color || '#94a3b8'}"></span>
          <h2>${ZONE_LETTER[code]}</h2>
          <span class="zone-count">${zoneBooths.length} stant</span>
        </div>
        <div class="zone-rows">${rows}</div>
      </section>
    `;
  }).join('');
}

export function buildKrokiHtml(
  zones: ZoneDensityInfo[],
  booths: AdminBooth[],
  stages: AdminStage[] = [],
  floorPlanUrl?: string | null,
  eventName = 'Take Off',
  walls: FloorPlanWall[] = [],
) {
  const generatedAt = new Date().toLocaleString('tr-TR');
  const placed = booths.filter(isBoothPlaced);

  const bodySection = floorPlanUrl
    ? buildPhotoOverlaySection(floorPlanUrl, zones, booths, stages, walls)
    : buildAbstractGridSection(zones, booths);

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
        .photo-wrap { position: relative; width: 100%; margin-bottom: 14px; page-break-inside: avoid; }
        .photo { width: 100%; display: block; border-radius: 10px; border: 1px solid #e2e8f0; }
        .wall-overlay { position: absolute; inset: 0; width: 100%; height: 100%; }
        .wall-overlay line { stroke: #dc2626; stroke-width: 1.6; stroke-linecap: round; }
        .pin { position: absolute; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 3px; }
        .pin-dot { width: 9px; height: 9px; border-radius: 5px; border: 1.5px solid white; box-shadow: 0 0 0 1px rgba(0,0,0,0.25); flex-shrink: 0; }
        .stage-dot { background: #f59e0b; }
        .pin-label { font-size: 8px; font-weight: 700; color: #0f172a; background: rgba(255,255,255,0.92); padding: 1px 4px; border-radius: 4px; white-space: nowrap; }
        .stage-label { color: #92400e; }
        .legend-line { display: flex; gap: 16px; margin-bottom: 18px; }
        .legend-item { display: flex; align-items: center; gap: 5px; font-size: 10px; color: #475569; }
        .legend-wall { display: inline-block; width: 12px; height: 2px; background: #dc2626; border-radius: 2px; }
        .zone { margin-bottom: 20px; page-break-inside: avoid; }
        .zone-header { display: flex; align-items: center; gap: 8px; border-left: 4px solid; padding-left: 8px; margin-bottom: 8px; }
        .zone-dot { width: 10px; height: 10px; border-radius: 5px; flex-shrink: 0; }
        .zone-header h2 { font-size: 14px; margin: 0; flex: 1; }
        .zone-count { color: #94a3b8; font-size: 9px; font-weight: 600; }
        .zone-rows { display: flex; flex-direction: column; gap: 4px; }
        .zone-row { display: flex; align-items: center; gap: 8px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 9px; font-size: 10px; }
        .zone-row-no { font-weight: 700; min-width: 42px; }
        .zone-row-name { color: #475569; }
        .zone-row-empty { color: #cbd5e1; border-style: dashed; justify-content: center; }
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
