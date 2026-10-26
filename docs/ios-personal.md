# Validación de iOS desde Linux

La primera fase comprueba que la cuenta gratuita puede firmar e instalar una app
con WidgetKit y App Intents. No modifica la instalación de Abacus de la App Store
ni conecta con Firefly. La integración completa depende de superar esta prueba.

## Compilación

Ejecutar manualmente `iOS personal validation` en el fork de GitHub. El runner
macOS genera un IPA sin firmar; no recibe credenciales de Apple ni de Firefly.
Descargar el artefacto `abacus-probe-unsigned` en `artifacts/`.

El segundo trabajo compila la base React Native con `APP_VARIANT=personal` y
produce `abacus-personal-unsigned`. Esta variante tiene identificador y esquema
propios y las actualizaciones OTA originales desactivadas. Para instalarla:

```bash
bash scripts/ios-personal-install.sh artifacts/abacus-personal-unsigned.ipa
```

La nueva instalación requiere configurar Firefly de nuevo. Si se usa OAuth,
registrar en Firefly la URL de retorno que muestre Abacus Personal.

El trabajo nativo verifica el ejecutable, la identidad de la app y del widget,
la URL de apertura y los metadatos compilados de App Intents antes de publicar
el artefacto. La misma comprobación se puede ejecutar localmente con
`python3 scripts/verify-ios-probe.py artifacts/abacus-probe-unsigned.ipa`.

## Firma e instalación local

Descargar `xtool-x86_64.AppImage` desde la versión oficial 1.24.0 de
<https://github.com/xtool-org/xtool/releases/tag/1.24.0> a `.tools/xtool.AppImage`
y darle permiso de ejecución. Estos directorios están excluidos de Git.

Iniciar sesión desde una terminal propia (no introducir secretos en el chat):

```bash
.tools/xtool.AppImage --appimage-extract-and-run auth login --mode password
bash scripts/ios-personal-install.sh
```

xtool firma el IPA usando la cuenta local y lo instala por USB. Puede solicitar
elegir el equipo de desarrollo. Completar en el iPhone los pasos de confianza y
Modo de desarrollador que solicite iOS. No enviar contraseñas a GitHub Actions.

## Comprobación en el iPhone

1. Abrir «Abacus Test» y comprobar que aparece la pantalla de prueba.
2. Añadir «Prueba de captura» desde la galería de widgets y tocar «Nuevo gasto».
3. Comprobar que la app muestra «Acceso desde el widget correcto».
4. Buscar «Preparar gasto de prueba» de Abacus Test en Atajos y ejecutarlo.
5. Confirmar que abre la app también después de cerrarla.

No se registra ningún gasto durante estas pruebas. Si falla la firma de una
extensión o requiere una capacidad de pago, registrar el error y detener esta
fase antes de implementar la integración completa.

## Renovación

Con cuenta gratuita, los perfiles expiran a los siete días. Conectar el iPhone y
repetir `bash scripts/ios-personal-install.sh` con el mismo IPA e identidad para
renovar la firma. No desinstalar la app como parte de la renovación. Esta ruta
debe verificarse en el dispositivo antes de considerarse operativa.

Referencias: [xtool](https://github.com/xtool-org/xtool),
[límites de cuenta gratuita](https://developer.apple.com/help/account/basics/about-your-developer-account).

## xcross

Se revisó también <https://github.com/arxdeus/xcross>. La compilación de React
Native sigue pendiente en <https://github.com/arxdeus/xcross/issues/21>; por eso
no sustituye al runner macOS para este proyecto. No se instala Flutter ni se
migra la aplicación a otro framework para esta prueba.
