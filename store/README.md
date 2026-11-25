# Paquete de publicación de Recreo

La PWA está empaquetada con **Capacitor 8** para iOS y Android. Proyectos nativos ya generados en `android/` e `ios/`.

## Qué hay aquí

| Archivo | Para qué |
| --- | --- |
| [release-checklist.md](release-checklist.md) | Pasos completos: servidor, firma, AAB, Xcode, consolas y pruebas |
| [listing-es.md](listing-es.md) | Textos, categorías, palabras clave, capturas y notas de revisión |
| [../public/privacidad.html](../public/privacidad.html) | Política de privacidad publicable en `https://TU-DOMINIO/privacidad.html` |
| [../public/soporte.html](../public/soporte.html) | Página de soporte para las fichas |
| [../resources/](../resources) | Icono 1024, adaptive icon y splash de origen |
| [../capacitor.config.ts](../capacitor.config.ts) | Nombre, bundle `com.recreo.app`, splash y barra de estado |
| [screenshots/](screenshots) | 6 capturas para iPhone 6.7" (1290×2796) y Android (1080×1920) |

## Comandos

```bash
# 1. URL del servidor de salas (Socket.IO con HTTPS)
cp .env.mobile.example .env.mobile   # edita VITE_SERVER_URL

# 2. Compilar la web y copiarla a las plataformas nativas
npm run mobile:sync

# 3. Abrir cada proyecto
npm run mobile:android   # Android Studio
npm run mobile:ios       # Xcode (solo macOS)

# 4. Regenerar iconos y splash si cambia la marca
npm run mobile:assets

# 5. Regenerar capturas de tienda (con `npm run dev` activo; usa Chrome/Edge)
npm run shots:store
```

## Firmas y limitaciones

- **Android**: se puede compilar y firmar en Windows/macOS/Linux con Android Studio y SDK 36. El resultado para Play es un `.aab` firmado.
- **iOS**: el proyecto se abre en Xcode, pero compilar y subir a App Store Connect requiere **macOS**. Desde Windows puedes preparar todo, no archivar.
- El backend debe estar desplegado con HTTPS/WSS antes de probar en tienda; el [Dockerfile](../Dockerfile) está listo para Render/Railway/Fly/VPS.
- Sustituye los marcadores `TU-DOMINIO` y `soporte@TU-DOMINIO.com` antes de enviar a revisión.
