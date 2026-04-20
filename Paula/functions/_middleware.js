// ============================================
// PAGES MIDDLEWARE — Bloqueo geográfico
// Se ejecuta en cada request antes de servir archivos estáticos
// ============================================

// Países bloqueados (ISO 3166-1 alpha-2)
const BLOCKED_COUNTRIES = [
  'VE', // Venezuela
  'CO', // Colombia
];

export async function onRequest(context) {
  const { request, next } = context;

  // Cloudflare expone el país del visitante en request.cf.country
  const country = request.cf?.country || request.headers.get('cf-ipcountry') || '';

  if (BLOCKED_COUNTRIES.includes(country.toUpperCase())) {
    // Devolver una respuesta 451 (Unavailable For Legal Reasons) sin revelar el motivo real
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not available</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #888;
      padding: 20px;
      text-align: center;
    }
    .container { max-width: 400px; }
    h1 { font-size: 22px; color: #fff; margin-bottom: 12px; font-weight: 700; }
    p { font-size: 14px; line-height: 1.6; opacity: .7; }
    .icon { font-size: 48px; margin-bottom: 20px; opacity: .3; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🔒</div>
    <h1>Content not available in your region</h1>
    <p>This content cannot be accessed from your current location.</p>
  </div>
</body>
</html>`,
      {
        status: 451,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Blocked-Country': country
        }
      }
    );
  }

  // País permitido → continuar con la request normal
  return next();
}
