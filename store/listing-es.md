# Recreo — ficha para App Store y Google Play

Datos listos para copiar en App Store Connect y Google Play Console. Sustituye los textos entre `[corchetes]` por los tuyos.

## Identidad

| Campo | Valor |
| --- | --- |
| Nombre en tienda | Recreo — juegos y calle |
| Bundle / Application ID | `com.recreo.app` |
| Versión inicial | 1.0 (build 1) |
| Categoría principal | Juegos > Familia |
| Categoría secundaria | Juegos > Casual / Entretenimiento |
| Precio | Gratis, sin compras integradas |
| Idiomas | Español (es-ES) |
| Web / soporte | `https://[TU-DOMINIO]/soporte.html` |
| Privacidad | `https://[TU-DOMINIO]/privacidad.html` |
| Correo de soporte | `soporte@[TU-DOMINIO]` |

## Textos

### App Store (iOS)

**Subtítulo (máx. 30):**
Más de 1000 juegos, dentro y fuera

**Texto promocional (máx. 170):**
Juega solo, con amigos en el mismo móvil, en salas online o al aire libre. Escondite, captura la bandera y pilla-pilla con zona en el mapa, tiempos ajustables y avisos cuando alguien sale de la zona.

**Descripción:**
Recreo reúne más de 1000 juegos para tu móvil y para jugar en la calle con tus amigos.

DENTRO DE LA APP
• Arcade, puzzles, cartas, tableros, palabras, memoria, matemáticas y trivia.
• Un jugador, por turnos en el mismo móvil o salas online con código.
• Modo aleatorio contra bots con dificultad ajustable o contra otras personas.
• Ligas por puntos y rachas de victorias.
• Controles táctiles, joystick y deslizamiento.

EN LA CALLE
• Escondite, captura la bandera, pilla-pilla y búsqueda del tesoro con guías claras.
• Salas privadas solo con el código que compartas.
• Elige la zona de juego en un mapa mundial, ajusta su tamaño y la duración de la partida.
• La zona se cierra sola cada ronda. Si sales, tus amigos ven tu ubicación en vivo; si tardas en volver, quedas eliminado.

SEGURO Y PRIVADO
• Sin cuentas, sin anuncios y sin compras.
• La ubicación es opcional, solo en salas de calle y solo mientras compartes.
• Chat con filtro de insultos, silenciar y reportar.
• Mensajes privados solo entre amigos.

Recreo es para echar un rato: pausas cortas, viajes y tardes en la calle.

**Novedades de la versión 1.0:**
Primera versión de Recreo: más de 1000 juegos, salas online, modo aleatorio con ligas y juegos de calle con mapa de zona ajustable.

**Palabras clave (máx. 100):**
juegos,multijugador,salas,amigos,calle,escondite,bandera,pilla,puzzle,trivia,liga,local

### Google Play

**Nombre (máx. 30):**
Recreo — juegos y calle

**Descripción corta (máx. 80):**
Más de 1000 juegos: solo, con amigos, online y en la calle.

**Descripción completa (máx. 4000):** usa la descripción de App Store anterior.

**Categoría:** Juegos > Familiar. **Etiquetas:** multijugador, casual, familiar.

## Clasificación por edades

- Contiene **contenido generado por usuarios** (chat de sala y privados) y **ubicación compartida**. Responde sí a interacción entre usuarios.
- No hay compras, anuncios ni apuestas.
- Edad recomendada: **12+ / Teen / PEGI 12**. Revisa el cuestionario de cada tienda y responde según el chat moderable y la ubicación.

## Capturas necesarias

Genera capturas **sin datos personales** (nombres genéricos, código de sala ficticio).

**App Store (iPhone 6,9" y 6,5" obligatorias; iPad opcional si admites iPad):**
1. Inicio con las secciones «Juegos en la app» y «Juegos de vida real».
2. Catálogo/Explorar con buscador.
3. Partida de puzzle o arcade en curso.
4. Sala de calle con mapa mundial y zona.
5. Mapa de partida con jugadores y aviso de zona.
6. Perfil con liga y ajustes.

Tamaños orientativos: `1290×2796` (6,7") y `1242×2688` (6,5"). Mínimo 3, máximo 10.

**Google Play (mínimo 2):**
Teléfono: `1080×1920` o `1440×2560` (proporción 9:16), mínimo 320 px, máximo 3840 px. Añade una gráfica de funciones si quieres (1024×500).

**Icono de tienda:** `1024×1024` PNG sin transparencia. Ya está en `resources/icon.png`.

**Gráfica destacada Play:** `1024×500` PNG/JPG.

## Notas para el revisor (App Store / Play)

- La app no requiere registro ni cuenta. Abre directamente.
- Para probar salas online: Inicio > Salas, crear sala; se puede probar solo con bots desde Modo aleatorio.
- Para probar juegos de calle: abre cualquier juego de «Juegos de vida real», crea una sala y pulsa «Permitir ubicación». La ubicación es opcional; sin ella se puede navegar por toda la app.
- Las salas de calle usan un mapa mundial: toca el mapa para fijar el centro y elige un radio. La zona se reduce un 15 % por ronda.
- No hay contenido de pago, anuncios ni inicio de sesión. Los reportes de chat se guardan en memoria del servidor.
- Contacto de revisión: `soporte@[TU-DOMINIO]`.

## Riesgo a revisar (Apple 4.2)

Apple puede rechazar apps que parezcan solo una web dentro de un contenedor. Recreo incluye funciones nativas (geolocalización real, mapas, permisos del sistema, modo offline) y contenido propio; aun así, si el revisor lo pide, añade valor nativo antes de reenviar (notificaciones push de sala, widgets o haptics). En Play no suele ser un problema.
