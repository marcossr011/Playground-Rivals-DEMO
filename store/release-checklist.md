# Checklist de publicación — Recreo 1.0

Sigue este orden. Cada bloque deja algo verificable.

## 0. Antes de empezar

- [ ] Sustituye `TU-DOMINIO` en [public/privacidad.html](../public/privacidad.html), [public/soporte.html](../public/soporte.html) y [store/listing-es.md](../store/listing-es.md) por tu dominio y correo reales.
- [ ] Publica esas dos páginas en `https://TU-DOMINIO/privacidad.html` y `https://TU-DOMINIO/soporte.html` (sirven GitHub Pages, Netlify o tu propio hosting estático).
- [ ] Ten a mano: Google Play Console (25 $ único), Apple Developer Program (99 €/año) y un Mac con Xcode para iOS.

## 1. Servidor de salas en producción (obligatorio)

La app nativa no puede usar `localhost`: necesita un servidor Socket.IO público con HTTPS/WSS.

- [ ] Despliega el backend con el [Dockerfile](../Dockerfile) o el comando `npm start` en Render, Railway, Fly.io, VPS…
- [ ] Configura `PORT` (el hosting suele inyectarlo) y deja una sola instancia: las salas viven en memoria.
- [ ] Comprueba `https://TU-SERVIDOR/socket.io/?EIO=4&transport=polling` → debe devolver un `0{...}`.
- [ ] El servidor ya permite CORS (`origin: true`); no necesitas dominio fijo para la app.
- [ ] Copia `.env.mobile.example` a `.env.mobile` y pon la URL **https** del servidor:
  ```
  VITE_SERVER_URL=https://api.TU-DOMINIO.com
  ```
- [ ] Verifica desde el móvil que se puede crear una sala online y una de calle con datos móviles.

## 2. Compilar y sincronizar la app

```bash
npm ci
npm run mobile:assets     # iconos y splash (ya generados; repite si cambias el logo)
npm run mobile:sync       # build web + copia a android/ e ios/
```

- [ ] `build:mobile` falla a propósito si falta `VITE_SERVER_URL`.
- [ ] `npm run mobile:android` abre Android Studio.
- [ ] `npm run mobile:ios` abre Xcode (solo macOS).

## 3. Android (Google Play)

- [ ] Sube `versionCode` y `versionName` en [android/app/build.gradle](../android/app/build.gradle) antes de cada entrega (`versionCode` siempre crece).
- [ ] Abre el proyecto en Android Studio (versión reciente, con JDK 21 y SDK 36) y deja que sincronice Gradle.
- [ ] Crea el keystore de subida **una sola vez** y guárdalo fuera del proyecto con su contraseña:
  ```bash
  keytool -genkey -v -keystore recreo-upload.keystore -alias recreo \
    -keyalg RSA -keysize 2048 -validity 10000
  ```
- [ ] Firma el bundle: **Build > Generate Signed Bundle / APK > Android App Bundle**, o por consola con `./gradlew bundleRelease` configurando `signingConfigs` fuera del repo.
- [ ] Salida: `android/app/build/outputs/bundle/release/app-release.aab`.
- [ ] Prueba en un dispositivo real con `Bundle` en la pista **Internal testing** antes de producción.
- [ ] La app pide ubicación solo al pulsar «Permitir ubicación» dentro de una sala de calle; la divulgación previa está en pantalla (requisito de Play).

### Ficha en Play Console

- [ ] Crea la app con el nombre y textos de [store/listing-es.md](../store/listing-es.md).
- [ ] Categoría **Juegos > Familiar**, etiquetas multijugador/casual.
- [ ] **Seguridad de los datos**:
  - Ubicación aproximada y precisa: recogida y compartida con otros jugadores de la sala, cifrada en tránsito, opcional, finalidad «funciones de la app», eliminada al terminar la partida.
  - Mensajes de usuario: recogidos (chat) para funciones de la app y moderación.
  - Nombre/avatar: recogidos, visibles para la sala.
  - No hay publicidad, no hay venta de datos, no hay cuentas.
  - Eliminación de datos: borrado local desde ajustes y solicitud por correo.
- [ ] **Contenido generado por usuarios**: sí. Indica que hay filtro, silencio y reportes.
- [ ] **Anuncios**: no. **Compras**: no. **Acceso**: sin login (marca «Toda la funcionalidad está disponible sin restricciones»).
- [ ] Cuestionario de clasificación de contenido según el chat y la ubicación (normalmente Teen).
- [ ] Sube capturas y gráfica, y revisa la política de privacidad (URL pública).

## 4. iOS (App Store)

- [ ] En un Mac con Xcode 16+, abre `ios/App/App.xcodeproj` (Capacitor 8 usa Swift Package Manager; no hace falta CocoaPods).
- [ ] En **Signing & Capabilities**: elige tu equipo, bundle `com.recreo.app` y deja «Automatically manage signing».
- [ ] Confirma el permiso de ubicación: [ios/App/App/Info.plist](../ios/App/App/Info.plist) ya incluye `NSLocationWhenInUseUsageDescription` en español.
- [ ] Sube `MARKETING_VERSION` y `CURRENT_PROJECT_VERSION` en el proyecto (1.0 / 1 → 2, 3…).
- [ ] Elige «Any iOS Device», **Product > Archive** y distribuye a **TestFlight**.
- [ ] Prueba en iPhone real: permiso de ubicación concedido y denegado, mapas, partida online y sala de calle.

### Ficha en App Store Connect

- [ ] Crea la app con el bundle `com.recreo.app` y los textos de [store/listing-es.md](../store/listing-es.md).
- [ ] **Privacidad de la app**:
  - Ubicación precisa: usada para funciones de la app, no para seguimiento, no vinculada a identidad (no hay cuentas).
  - Contenido del usuario (chat): usado para funciones de la app y moderación.
  - No hay datos publicitarios ni seguimiento; `NSUserTrackingUsageDescription` no es necesario.
  - El cifrado estándar ya está declarado (`ITSAppUsesNonExemptEncryption = false`).
- [ ] Clasificación 12+ por interacción entre usuarios; marca que hay moderación (filtro, silencio, reportes).
- [ ] **Notas para el revisor**: explica cómo abrir una sala de calle y que la ubicación es opcional (ver ficha). Apple puede preguntar por la regla 4.2 (wrapper web): destaca geolocalización nativa, permisos del sistema, mapa y contenido propio; si insisten, añade una función nativa extra antes de reenviar.
- [ ] Adjunta capturas de iPhone 6,9" y 6,5"; iPad solo si mantienes soporte iPad.

## 5. Pruebas mínimas antes de enviar

- [ ] Instalación limpia en Android e iOS; arranque sin conexión (la UI debe cargar; las salas muestran su error).
- [ ] Crear sala online y de calle con datos móviles reales (WSS).
- [ ] Denegar ubicación: la app sigue usable y muestra el mensaje.
- [ ] Conceder ubicación: centro en el mapa mundial, radios 100 m–5 km, inicio bloqueado sin zona.
- [ ] Dos móviles: dentro oculto hasta la ronda, fuera visible en vivo, eliminación tras la gracia, ganador al final.
- [ ] Chat: filtro, silenciar y reportar. Privados entre amigos.
- [ ] Modo aleatorio y liga tras reiniciar partida.
- [ ] Sin pantallas rotas en 390×844 y 430×932; barra inferior respeta el safe area.
- [ ] Icono, splash y nombre correctos en la pantalla de inicio.

## 6. Después de publicar

- [ ] Guarda el keystore Android y las credenciales de App Store Connect con doble copia.
- [ ] Versiona cada entrega (Android `versionCode` +1; iOS build +1).
- [ ] Mantén el servidor con una sola réplica mientras las salas sean en memoria; si escalas, añade Redis y sticky sessions.
- [ ] Revisa reportes de chat y actualiza la política si añades funciones nuevas (notificaciones, cuentas, pagos).
