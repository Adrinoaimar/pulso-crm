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
- Conexión de demostración por QR desde Configuración > Integraciones: generar QR, simular escaneo, desconectar y conservar estado local.
- Botón `Agregar API key` opcional. Clave se guarda en navegador, se valida y nunca se muestra después de guardar. No se envía a servidor en esta demo.
- Bandeja operativa sin red: enviar con Enter, notas internas, sugerencias IA, entrada simulada y Autopiloto con escalamiento.
- Crear negocios desde Contactos/Bandeja/Pipeline, mover etapas y activar automatizaciones.

## Límites de la demo

No hay backend, autenticación real, mensajería externa ni modelo IA conectado. QR y IA son simulaciones locales para validar flujo completo. Datos viven solo en este navegador. Para WhatsApp real hace falta un bridge/backend que mantenga sesión QR y transporte de mensajes; no se debe exponer API keys en un frontend público. Adjuntos, webhooks y proveedores externos son marcadores de integración futura. La fuente se carga desde Google Fonts en desarrollo; las familias de respaldo mantienen la UI si no hay red.
