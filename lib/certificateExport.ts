// Katılım sertifikasını basılabilir bir HTML sayfasına dönüştüren saf
// fonksiyon — TAM OLARAK lib/krokiExport.ts'teki desenin aynısı: bu dosya
// hiçbir native modül import ETMEZ (expo-print/expo-sharing çağrıları,
// bu HTML'i kullanan ekranda LAZY require() ile yapılır, bkz.
// app/(tabs)/profile.tsx > handleDownloadCertificate).

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildCertificateHtml(
  fullName: string,
  eventName: string,
  badgeNames: string[],
  generatedAtLabel: string,
) {
  const badgeRows = badgeNames.length
    ? badgeNames.map((name) => `<li>${escapeHtml(name)}</li>`).join('')
    : '<li class="empty">Henüz kazanılmış bir rozet yok.</li>';

  return `<!doctype html>
  <html lang="tr">
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, Helvetica, Arial, sans-serif;
          color: #0f172a;
          padding: 0;
          margin: 0;
        }
        .sheet {
          margin: 24px;
          padding: 48px;
          border: 3px solid #c85000;
          border-radius: 18px;
          text-align: center;
        }
        .eyebrow {
          color: #c85000;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 3px;
          text-transform: uppercase;
        }
        h1 { font-size: 30px; margin: 10px 0 4px 0; }
        .event { color: #4c6173; font-size: 14px; margin-bottom: 28px; }
        .presented { color: #4c6173; font-size: 13px; margin-bottom: 6px; }
        .name { font-size: 26px; font-weight: 800; margin: 0 0 28px 0; color: #191c1d; }
        .section-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #4c6173;
          margin-bottom: 10px;
        }
        ul { list-style: none; padding: 0; margin: 0 0 30px 0; }
        li {
          font-size: 13px;
          padding: 8px 0;
          border-bottom: 1px solid #edeeef;
          color: #191c1d;
        }
        li.empty { color: #94a3b8; font-style: italic; }
        .footer { color: #94a3b8; font-size: 10px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="eyebrow">Katılım Sertifikası</div>
        <h1>${escapeHtml(eventName)}</h1>
        <div class="event">Etkinlik boyunca aktif katılım gösterdiğiniz için teşekkür ederiz.</div>
        <div class="presented">Bu sertifika şu kişiye verilmiştir:</div>
        <div class="name">${escapeHtml(fullName)}</div>
        <div class="section-title">Kazanılan Rozetler (${badgeNames.length})</div>
        <ul>${badgeRows}</ul>
        <div class="footer">Oluşturulma: ${escapeHtml(generatedAtLabel)}</div>
      </div>
    </body>
  </html>`;
}
