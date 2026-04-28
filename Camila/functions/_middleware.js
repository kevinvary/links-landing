// ============================================
// PAGES MIDDLEWARE — Geo tracking server-side
// ============================================
// Inyecta window.__cfCountry, __cfCity, __cfRegion en el HTML
// Usa request.cf (source of truth de Cloudflare)

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

  const response = await next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const geoScript = `<script>window.__cfCountry=${jsonEsc(country)};window.__cfCity=${jsonEsc(city)};window.__cfRegion=${jsonEsc(region)};</script>`;

  const rewriter = new HTMLRewriter().on('head', {
    element(element) { element.prepend(geoScript, { html: true }); }
  });

  const transformed = rewriter.transform(response);
  const newHeaders = new Headers(transformed.headers);
  newHeaders.set('X-CF-Country', country);
  newHeaders.set('X-CF-City', city);
  newHeaders.set('X-CF-Region', region);
  newHeaders.set('Cache-Control', 'no-store');

  return new Response(transformed.body, {
    status: transformed.status,
    statusText: transformed.statusText,
    headers: newHeaders
  });
}
