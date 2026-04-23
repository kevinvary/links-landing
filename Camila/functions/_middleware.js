// ============================================
// PAGES MIDDLEWARE — Geo tracking server-side
// ============================================
// Inyecta window.__cfCountry en el HTML usando request.cf.country
// (source of truth de Cloudflare — no depende de ipapi.co)
// Permite verificar con ?debug=1 en la URL o headers X-CF-Country

export async function onRequest(context) {
  const { request, next } = context;
  const country = (request.cf?.country || request.headers.get('cf-ipcountry') || 'XX').toUpperCase();

  const response = await next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const geoScript = `<script>window.__cfCountry=${JSON.stringify(country)};</script>`;

  const rewriter = new HTMLRewriter().on('head', {
    element(element) { element.prepend(geoScript, { html: true }); }
  });

  const transformed = rewriter.transform(response);
  const newHeaders = new Headers(transformed.headers);
  newHeaders.set('X-CF-Country', country);
  newHeaders.set('Cache-Control', 'no-store');

  return new Response(transformed.body, {
    status: transformed.status,
    statusText: transformed.statusText,
    headers: newHeaders
  });
}
