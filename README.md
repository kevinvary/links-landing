# Links — Landing Pages

Landing pages multi-modelo desplegadas en Cloudflare Pages.

## Estructura

- `Paula/` — Landing de Paula (i18n ES/EN/PT + geo-filter + edge middleware)
- `Lucia/` — Landing de Lucia
- `Camila/` — Landing de Camila
- `Plan101/` — Plan de contenido para las modelos (101 agency): una página sin listar por modelo con su video. `noindex`, sin enlaces desde las landings.

Cada carpeta es un proyecto independiente de Cloudflare Pages con su propio video de fondo y configuración.

## Features

- Ruleta con 6 premios y probabilidad ponderada
- Escape del in-app browser (Instagram/TikTok) con fallback long-press para iOS
- Verificación de edad 18+
- Countdown con persistencia en localStorage
- Multi-idioma (ES/EN/PT) con detección automática por país (Paula)
- Middleware edge para bloqueo de países (Paula)

## Deploy

```bash
# Paula
cd Paula && npx wrangler pages deploy . --project-name=paulapaidig

# Lucia
cd Lucia && npx wrangler pages deploy . --project-name=lucialinks

# Camila
cd Camila && npx wrangler pages deploy . --project-name=camilalinks

# Plan de contenido 101 (proyecto propio; no toca las landings)
cd Plan101 && npx wrangler pages deploy . --project-name=plan101
```
