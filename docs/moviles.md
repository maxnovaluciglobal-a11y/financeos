# Envoltorios móviles de MOY IQ: Android (TWA) e iOS (Capacitor)

Movido de `CLAUDE.md` el 19-oct-2026 (auditoría 360, C-08). Las rutas, el package ID y el estado de `assetlinks.json` se verificaron ese día contra el disco y contra producción. Lo marcado "17-sep, no reverificado" es lo que quedó registrado entonces y no se volvió a comprobar.

Ningún envoltorio está publicado en tiendas, y no se publica hasta tener al menos 10 pagos (D-09, decisión delegada del 19-oct).

## Android (TWA con Bubblewrap)

**Dónde está.** `05 - Producto/moyiq-android-twa/` (sin git, junto a este repo). La ruta tiene espacios: citarla siempre, y `twa-manifest.json` apunta al keystore con ruta absoluta. El 17-sep el proyecto estaba en `~/moyiq-android-twa/` y el paquete viejo en `../android-twa/package/`; ninguna de las dos rutas existe hoy.

**Package real: `app.moyiq.app.twa`** (`twa-manifest.json` y `applicationId` en `app/build.gradle`). Este archivo y la memoria del 17-sep decían `com.moyiq.app.twa`: era un error.

**Desajuste con `assetlinks.json` (OPS-7, pendiente en C-28).** `public/.well-known/assetlinks.json` (publicado en `https://app.moyiq.app/.well-known/assetlinks.json`, verificado con `curl` el 19-oct) declara `com.moyiq.app.twa`, y el APK es `app.moyiq.app.twa`. Con paquetes distintos Android no valida Digital Asset Links y la app abre como pestaña personalizada con barra de URL, no a pantalla completa. La huella SHA-256 sí coincide (OPS-7). Hay que elegir el package ID definitivo **antes** de subir a Play, porque después no se cambia (recomendado `com.moyiq.app.twa`, como iOS). Con Play App Signing, además, hay que sumar al JSON la huella de "App signing key" de Play Console.

**Paquete de agosto (OBSOLETO, no usar).** Generado como "FinanceOS" antes del rename, con package `com.financeospro.app.twa`; nunca se publicó. El bloqueo de marca de entonces (FINANCEOS® de Datarails en USPTO, memoria `financeos_android_twa_20260822`) lo resolvió el rename a MOY IQ.

**Estado del build (17-sep, no reverificado).** Regenerado y firmado; alias del keystore `moyiq-upload`, certificado CN=Walter La Madriz / OU=Engineering / O=MAXNOVA & LUCI Global LLC / C=US.

- Se compila con `bubblewrap build`, no con `gradlew assembleRelease` directo (ese deja un APK sin firmar): orquesta Gradle y firma con `apksigner`, y deja `app-release-signed.apk` y `app-release-bundle.aab` en la raíz del proyecto. Antes hubo que completar el SDK con `sdkmanager` (`bubblewrap init` solo instala los cmdline-tools, no `platform-tools`, `build-tools` ni `platforms;android-34`) y crear un `local.properties` con `sdk.dir` apuntando a `~/.bubblewrap/android_sdk`.
- La huella SHA-256 se saca con `keytool -list -v -keystore android.keystore -alias moyiq-upload`; el subcomando `bubblewrap fingerprint` pide argumentos que su ayuda no documenta.
- Íconos maskable listos (`public/icon-{192,512}-maskable.png` y el manifest); Bubblewrap los toma solo del manifest.

**El keystore no tiene respaldo fuera de la Mac** (OPS-8; W-14 lo cubre con 1Password). Sin `android.keystore` y sus dos contraseñas no se puede volver a firmar una actualización bajo ese package ID: es irrecuperable si se pierde.

**Falta para publicar** (de Walter): cuenta de Google Play Console (US$ 25, pago único), instalar y probar el APK en un dispositivo real y subir el `.aab`.

## iOS (Capacitor)

**Dónde está.** `05 - Producto/moyiq-ios-capacitor/` (sin git, junto a este repo). El 17-sep estaba en `../ios-capacitor-moyiq/`; esa ruta no existe hoy. Se armó con `npx cap init` y `npx cap add ios`, sin CocoaPods: Capacitor 7 usa Swift Package Manager en el template de iOS.

**Modo "servidor remoto"**, igual que el TWA: `capacitor.config.json` tiene `appId: "com.moyiq.app.ios"` y `server.url: "https://app.moyiq.app/app/"` (verificado el 19-oct). La app nativa carga la PWA real dentro de un `WKWebView` y no empaqueta el código; los datos financieros siguen en IndexedDB del WebView, nunca en el servidor. Actualizar la app no exige subir una versión a App Store.

**Verificado el 17-sep, no reverificado.** `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator' build` dio `BUILD SUCCEEDED`; en el Simulator (iPhone 17 Pro) abre, carga `app.moyiq.app` y muestra el login de MOY IQ.

**Notch y Dynamic Island (17-sep, resuelto).** El banner del modo demo se solapaba con el status bar. La causa no era el wrapper nativo (se descartó leyendo `CAPBridgeViewController.swift` y `CAPInstanceDescriptor.swift`, y `contentInset: "never"` no cambió nada): `src/demo/DemoBanner.jsx` no tenía el `env(safe-area-inset-top)` que sí tiene el header real de `Shell.jsx`. Arreglo de una línea (`paddingTop: 'max(8px, env(safe-area-inset-top))'`), commit `e4b8fc9`.

**Ícono de App Store (17-sep, resuelto).** `public/icon-1024-appstore.png`: 1024×1024, sin canal alpha, generado con `rsvg-convert` desde `icon-maskable-source.svg` (el mismo monograma que el maskable de Android) y copiado a `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` en el proyecto de iOS.

**Falta para publicar** (de Walter):

1. Cuenta de Apple Developer (US$ 99 al año): sin ella solo se corre en el Simulator.
2. Reservar el bundle ID `com.moyiq.app.ios` en App Store Connect.
3. Riesgo de revisión a evaluar antes de enviar: Apple rechaza más fácil que Google las apps que son solo una web envuelta (App Store Review Guideline 4.2, "Minimum Functionality"). Hoy es 100 % WebView, sin plugins nativos; biometría (Face ID para desbloquear, que encaja con "privacy-first"), notificaciones push o compartir nativo son los candidatos si hace falta reforzar el caso. Es una decisión de producto, no técnica.
