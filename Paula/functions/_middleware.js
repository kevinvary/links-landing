// ============================================
// PAGES MIDDLEWARE — Geo-filtering server-side
// ============================================
// 1. Bloquea Venezuela y Colombia (451)
// 2. Detecta país con request.cf.country (source of truth de Cloudflare)
// 3. Inyecta window.__cfCountry y window.__cfOnlyfansURL en el HTML
// Esto elimina la dependencia de ipapi.co (que puede fallar / tener rate limit)

const BLOCKED_COUNTRIES = ['VE', 'CO'];

// Links
const URL_PAID  = 'https://onlyfans.com/soypaulita';
const URL_TRIAL = 'https://onlyfans.com/soypaulita/trial/srasiqbrmgkg1vci7uk9eurhgb4na5xc';

// Países que reciben el TRIAL (el resto recibe el PAID por defecto)
const TRIAL_COUNTRIES = new Set([
  'MX', 'ES', 'US',
  // UE + UK + EFTA + microestados
  'FR','DE','IT','PT','NL','BE','AT','CH','SE','NO','DK','FI','IE','GB','IS',
  'LU','GR','PL','CZ','SK','HU','RO','BG','HR','SI','EE','LV','LT','MT','CY',
  'AD','MC','LI','SM'
]);

const BLOCKED_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Not available</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#888;padding:20px;text-align:center}.container{max-width:400px}h1{font-size:22px;color:#fff;margin-bottom:12px;font-weight:700}p{font-size:14px;line-height:1.6;opacity:.7}.icon{font-size:48px;margin-bottom:20px;opacity:.3}</style>
</head><body><div class="container"><div class="icon">🔒</div><h1>Content not available in your region</h1><p>This content cannot be accessed from your current location.</p></div></body></html>`;

export async function onRequest(context) {
  const { request, next } = context;
  const country = (request.cf?.country || request.headers.get('cf-ipcountry') || 'XX').toUpperCase();

  // 1. Bloqueo
  if (BLOCKED_COUNTRIES.includes(country)) {
    return new Response(BLOCKED_HTML, {
      status: 451,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Blocked-Country': country
      }
    });
  }

  // 2. Decidir el link según país
  const isTrial = TRIAL_COUNTRIES.has(country);
  const onlyfansURL = isTrial ? URL_TRIAL : URL_PAID;

  // 3. Obtener la response original y, si es HTML, inyectar geo info
  const response = await next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const geoScript = `<script>window.__cfCountry=${JSON.stringify(country)};window.__cfIsTrial=${isTrial};window.__cfOnlyfansURL=${JSON.stringify(onlyfansURL)};</script>`;

  const rewriter = new HTMLRewriter().on('head', {
    element(element) { element.prepend(geoScript, { html: true }); }
  });

  // Añadir header debug para poder verificar con curl -I
  const transformed = rewriter.transform(response);
  const newHeaders = new Headers(transformed.headers);
  newHeaders.set('X-CF-Country', country);
  newHeaders.set('X-CF-Link-Type', isTrial ? 'trial' : 'paid');
  newHeaders.set('Cache-Control', 'no-store'); // evitar que CF cachee respuestas distintas por país

  return new Response(transformed.body, {
    status: transformed.status,
    statusText: transformed.statusText,
    headers: newHeaders
  });
}
