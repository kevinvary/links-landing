// ============================================
// PAGES MIDDLEWARE — Geo-filtering server-side
// ============================================
// 1. Bloquea Venezuela y Colombia (451)
// 2. Detecta país/ciudad/región con request.cf (source of truth de Cloudflare)
// 3. Inyecta window.__cfCountry, __cfCity, __cfRegion, __cfOnlyfansURL en el HTML

const BLOCKED_COUNTRIES = ['VE', 'CO'];

const URL_PAID  = 'https://onlyfans.com/soypaulita';
const URL_TRIAL = 'https://onlyfans.com/soypaulita/trial/srasiqbrmgkg1vci7uk9eurhgb4na5xc';

const TRIAL_COUNTRIES = new Set([
  'MX', 'ES', 'US',
  'FR','DE','IT','PT','NL','BE','AT','CH','SE','NO','DK','FI','IE','GB','IS',
  'LU','GR','PL','CZ','SK','HU','RO','BG','HR','SI','EE','LV','LT','MT','CY',
  'AD','MC','LI','SM'
]);

const BLOCKED_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Not available</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#888;padding:20px;text-align:center}.container{max-width:400px}h1{font-size:22px;color:#fff;margin-bottom:12px;font-weight:700}p{font-size:14px;line-height:1.6;opacity:.7}.icon{font-size:48px;margin-bottom:20px;opacity:.3}</style>
</head><body><div class="container"><div class="icon">🔒</div><h1>Content not available in your region</h1><p>This content cannot be accessed from your current location.</p></div></body></html>`;

function jsonEsc(s){ return JSON.stringify(s == null ? '' : String(s)); }

// Fetch ipapi.co con timeout y cache 24h por IP (más preciso que cf.city para muchos países)
async function fetchIpapi(ip) {
  if (!ip) return null;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 1200);
    const resp = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal,
      cf: { cacheTtl: 86400, cacheEverything: true }
    });
    clearTimeout(t);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.error) return null;
    return { city: data.city || '', region: data.region || '' };
  } catch (e) {
    return null;
  }
}

export async function onRequest(context) {
  const { request, next } = context;
  const cf = request.cf || {};
  const country = (cf.country || request.headers.get('cf-ipcountry') || 'XX').toUpperCase();
  const userIP = request.headers.get('cf-connecting-ip') || '';

  // Llamar a ipapi.co server-side para ciudad/región precisas (con cache por IP)
  const ipData = await fetchIpapi(userIP);
  const city = (ipData && ipData.city) || cf.city || '';
  const region = (ipData && ipData.region) || cf.region || '';

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

  const isTrial = TRIAL_COUNTRIES.has(country);
  const onlyfansURL = isTrial ? URL_TRIAL : URL_PAID;

  const response = await next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const geoScript = `<script>window.__cfCountry=${jsonEsc(country)};window.__cfCity=${jsonEsc(city)};window.__cfRegion=${jsonEsc(region)};window.__cfIsTrial=${isTrial};window.__cfOnlyfansURL=${jsonEsc(onlyfansURL)};</script>`;

  const rewriter = new HTMLRewriter().on('head', {
    element(element) { element.prepend(geoScript, { html: true }); }
  });

  const transformed = rewriter.transform(response);
  const newHeaders = new Headers(transformed.headers);
  newHeaders.set('X-CF-Country', country);
  newHeaders.set('X-CF-City', city);
  newHeaders.set('X-CF-Region', region);
  newHeaders.set('X-CF-Link-Type', isTrial ? 'trial' : 'paid');
  newHeaders.set('Cache-Control', 'no-store');

  return new Response(transformed.body, {
    status: transformed.status,
    statusText: transformed.statusText,
    headers: newHeaders
  });
}
