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
- Contratos reemplazables en `src/providers.ts`. `WhatsAppProvider` queda explícitamente en estado `Pendiente de API`; no realiza llamadas ni contiene credenciales.

## Límites de la demo

No hay backend, autenticación real, mensajería externa ni modelo IA conectado. Datos viven solo en este navegador. Adjuntos, webhooks y proveedores externos son marcadores de integración futura. La fuente se carga desde Google Fonts en desarrollo; las familias de respaldo mantienen la UI si no hay red.
