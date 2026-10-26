# Abacus Personal desde Linux

Versión personal de Abacus con plantillas, captura rápida, Atajos y widgets de
iOS. Se instala junto a la app original y requiere configurar Firefly de nuevo.
La prueba mínima de firma gratuita, widget y Atajos se completó en el iPhone
conectado antes de integrar estas funciones en React Native.

## Uso

1. En Abacus Personal, abre Ajustes → Accesos rápidos.
2. Pulsa Crear plantilla. El nombre es obligatorio; el importe puede quedar
   vacío para introducirlo al usarla. Cuenta, destino, categoría y presupuesto
   se rellenan con los mismos selectores de Firefly que las transacciones.
3. Toca una plantilla para revisar el gasto. Los detalles adicionales están
   plegados. La fecha es la actual y el gasto solo se envía al pulsar Guardar.
4. En Atajos, añade la acción Preparar gasto de Abacus Personal. Selecciona una
   plantilla y, si quieres, indica un importe o una descripción que sustituyan
   los valores guardados. Abre la app e inicia sesión al menos una vez para que
   las plantillas aparezcan en el selector del sistema.
5. Para configurar un widget, pulsa Copiar enlace para widget en una plantilla.
   Añade Captura rápida a la pantalla de inicio, edítalo y pega el enlace con un
   nombre para el botón. El tamaño pequeño abre el primer acceso configurado
   (Nuevo gasto por defecto). El mediano ofrece Nuevo gasto y hasta dos accesos.

Las plantillas se pueden editar, eliminar y ordenar. Los dos primeros accesos
también aparecen al mantener pulsado el icono, junto a Nuevo gasto y Accesos
rápidos. Las plantillas pertenecen al servidor y usuario de Firefly activos;
un enlace de otra cuenta no registra ni abre un gasto con datos de esa cuenta.

Los enlaces usan `abacus-personal://quick/expense?v=1` con `templateId`,
`amount`, `description` y `requestId` opcionales. La ruta `quick/templates?v=1`
abre la lista. Nunca deben incluir tokens ni credenciales. La acción nativa
genera un identificador de solicitud para evitar aperturas duplicadas. Los
enlaces esperan al inicio de sesión y a que se cierre cualquier formulario
abierto. No se almacenan solicitudes pendientes al cerrar el proceso.

## Compilación

La rama `feat/ios-personal-validation` ejecuta `iOS personal validation` al subir
cambios relevantes. Tras incorporar el workflow a la rama predeterminada también
puede ejecutarse manualmente. El runner
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
bash scripts/ios-personal-install.sh artifacts/abacus-probe-unsigned.ipa
```

Para la versión completa, ejecutar `bash scripts/ios-personal-install.sh`.
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

La compilación completa verifica también los identificadores, esquema, versión
del widget y metadatos de App Intents de Abacus Personal. Los widgets no usan
App Groups ni tienen acceso al token de Firefly; la selección de plantilla se
resuelve dentro de la app después del inicio de sesión.

## Comprobaciones de desarrollo

```bash
npm run test:quick-access
npx tsc --noEmit
npm run lint
APP_VARIANT=personal npx expo prebuild --platform ios --no-install
```

La comprobación Swift aislada se ejecuta antes de compilar React Native para
detectar pronto problemas con WidgetKit y App Intents. Las pruebas de lógica
cubren parámetros malformados, importes con coma/punto, precisión, deduplicación,
plantillas eliminadas y separación entre cuentas. Comprobar en el teléfono los
arranques en frío y caliente, modo claro/oscuro, texto ampliado y VoiceOver.

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
