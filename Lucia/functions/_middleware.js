// ============================================
// PAGES MIDDLEWARE — Geo-filtering server-side (Lucia)
// ============================================
// 1. Detecta país con request.cf
// 2. Llama a ipapi.co con cache 24h por IP para ciudad/región precisas
// 3. Inyecta window.__cfCountry, __cfCity, __cfRegion, __cfOnlyfansURL en el HTML

const URL_PAID  = 'https://onlyfans.com/soyylucia';
const URL_TRIAL = 'https://onlyfans.com/soyylucia/trial/1xrgtkukgmfafgdevcyfkphjdtapspsc';

// Mismos países que Paula: MX, ES, US, UE + UK + EFTA + microestados
const TRIAL_COUNTRIES = new Set([
  'MX', 'ES', 'US',
  'FR','DE','IT','PT','NL','BE','AT','CH','SE','NO','DK','FI','IE','GB','IS',
  'LU','GR','PL','CZ','SK','HU','RO','BG','HR','SI','EE','LV','LT','MT','CY',
  'AD','MC','LI','SM'
]);

function jsonEsc(s){ return JSON.stringify(s == null ? '' : String(s)); }

// Fetch ipapi.co con timeout y cache 24h por IP
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

  const ipData = await fetchIpapi(userIP);
  const city = (ipData && ipData.city) || cf.city || '';
  const region = (ipData && ipData.region) || cf.region || '';

  // Decidir link según país
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
