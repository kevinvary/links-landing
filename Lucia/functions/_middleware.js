// ============================================
// PAGES MIDDLEWARE — Geo tracking server-side
// ============================================
// Inyecta window.__cfCountry, __cfCity, __cfRegion en el HTML
// Usa request.cf (source of truth de Cloudflare)

function jsonEsc(s){ return JSON.stringify(s == null ? '' : String(s)); }

export async function onRequest(context) {
  const { request, next } = context;
  const cf = request.cf || {};
  const country = (cf.country || request.headers.get('cf-ipcountry') || 'XX').toUpperCase();
  const city = cf.city || '';
  const region = cf.region || '';

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
