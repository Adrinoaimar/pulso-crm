# Pulso CRM WhatsApp bridge

Backend real para vincular una cuenta WhatsApp Web con QR. Usa Baileys (`@whiskeysockets/baileys@7.0.0-rc14`) y guarda credenciales en `server/.data/auth`. No usa WhatsApp Cloud API.

## Local

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

Endpoints:

- `GET /health`
- `POST /api/whatsapp/connect` inicia sesión y genera QR real.
- `GET /api/whatsapp/status` devuelve `disconnected`, `connecting`, `qr` o `connected`.
- `GET /api/whatsapp/qr` devuelve texto QR y `dataUrl` para mostrarlo.
- `GET /api/events` (SSE) publica cambios de estado y mensajes entrantes.
- `POST /api/messages/send` con `{ "to": "51999999999", "text": "Hola" }` envía mensaje real.
- `POST /api/whatsapp/disconnect` cierra sesión de socket; credenciales quedan guardadas.

Si defines `API_TOKEN`, incluye `X-Pulso-Token` o `Authorization: Bearer <token>` en endpoints protegidos.

## Render / Railway

Crear servicio Node desde subdirectorio `server`:

- Build command: `npm ci`
- Start command: `npm start`
- Variables: `PORT` (la plataforma la inyecta), `CORS_ORIGIN` con dominio del frontend, `API_TOKEN` opcional.
- Añadir volumen persistente en `/app/server/.data` (Render Disk) o volumen Railway. Sin volumen, se pierde sesión QR en cada redeploy.

El proceso debe permanecer activo. GitHub Pages solo aloja frontend; no puede ejecutar Baileys.

## Seguridad

Usa token, CORS restringido, volumen privado. Nunca subas `.data`, `.env`, QR ni credenciales. WhatsApp puede cerrar sesiones automatizadas; cumple términos de servicio y usa número de prueba durante desarrollo.
