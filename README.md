# Pulso CRM

SPA operativa de demostración inspirada en patrones de bandeja compartida y gestión comercial. Identidad, textos y componentes son propios.

## Ejecutar

```bash
npm install
npm run dev
```

Validación:

```bash
npm test
npm run build
```

## Incluye

- Dashboard operativo, bandeja de tres paneles, contactos, pipeline Kanban, automatizaciones, centro de control IA, analítica y configuración.
- Flujos persistentes: enviar respuesta o nota, asignar, cambiar modo IA, crear contacto, mover negocio, activar automatización y configurar política IA.
- Persistencia local en `localStorage`, navegación en hash, atajos `/` y `Alt+1..5`, diseño responsive y estados offline.
- Conexión WhatsApp por QR real desde Configuración > Integraciones. URL bridge se define con `VITE_WA_BACKEND_URL` o directamente en navegador; QR se obtiene desde backend, estado se consulta por polling y mensajes entrantes llegan por SSE.
- Botón `Agregar API key` opcional. Clave se guarda en navegador y se envía solo al backend configurado mediante `X-Pulso-Token`.
- Bandeja envía mensajes reales al backend cuando sesión QR está conectada; sin bridge, modo demo local queda explícito.
- Crear negocios desde Contactos/Bandeja/Pipeline, mover etapas y activar automatizaciones.

## Contrato bridge WhatsApp

El frontend espera backend en `VITE_WA_BACKEND_URL` con:

- `GET /api/whatsapp/status` devuelve `{status, qrDataUrl?, phone?, error?}`.
- `POST /api/whatsapp/connect`, `GET /api/whatsapp/qr`, `POST /api/whatsapp/disconnect`.
- `POST /api/messages/send` recibe `{to, text, conversationId?}`.
- `GET /api/events` entrega SSE `status`, `qr` y `message`.

Datos CRM siguen en `localStorage`; autenticación multiusuario, adjuntos y webhooks quedan pendientes del bridge/producto. La fuente carga Google Fonts en desarrollo; familias respaldo mantienen UI sin red.
