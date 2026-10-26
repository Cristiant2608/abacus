# Abacus Personal desde Linux

Versión personal de Abacus con plantillas, captura rápida, Atajos y widgets de
iOS. Se instala junto a la app original y requiere configurar Firefly de nuevo.
La firma gratuita y los widgets funcionan en el iPhone conectado. La aparición
de acciones en Atajos sigue pendiente de verificación en el dispositivo.

## Uso

El inicio incluye ahora una pestaña **Resumen**: ingresos, gastos y flujo neto
por divisa para el período seleccionado, gastos sin categoría y últimos
movimientos. Las transferencias se excluyen del total de ingresos y gastos.
Deslizar para actualizar solicita todas las páginas de Firefly; una descarga
incompleta no sustituye la última captura completa de la misma sesión y cuenta.
Los importes respetan la opción de ocultar saldos y los cálculos conservan los
decimales como texto, incluidos los envíos de formularios normales.

1. En Abacus Personal, abre Ajustes → Accesos rápidos.
2. Pulsa Crear plantilla. El nombre es obligatorio; el importe puede quedar
   vacío para introducirlo al usarla. Cuenta, destino, categoría y presupuesto
   se rellenan con los mismos selectores de Firefly que las transacciones.
3. Toca una plantilla para revisar el movimiento. Los detalles adicionales están
   plegados. La fecha es la actual y el movimiento solo se envía al pulsar Guardar.
4. En Atajos, añade la acción Preparar movimiento de Abacus Personal. Selecciona una
   plantilla y, si quieres, indica un importe o una descripción que sustituyan
   los valores guardados. Abre la app e inicia sesión al menos una vez para que
   las plantillas aparezcan en el selector del sistema.
5. Para configurar un widget, pulsa Copiar enlace para widget en una plantilla.
   Añade Captura rápida a la pantalla de inicio, edítalo y pega el enlace con un
   nombre para el botón. El tamaño pequeño abre el primer acceso configurado
   (Nuevo movimiento por defecto). El mediano ofrece Nuevo movimiento y hasta dos accesos.

Las plantillas se pueden editar, eliminar y ordenar. Los dos primeros accesos
también aparecen al mantener pulsado el icono, junto a Nuevo movimiento y Accesos
rápidos. Las plantillas pertenecen al servidor y usuario de Firefly activos;
un enlace de otra cuenta no registra ni abre un gasto con datos de esa cuenta.

### Widgets y automatizaciones

En **Accesos rápidos → Widgets y automatizaciones** hay instrucciones del widget
nativo, un botón oficial para abrir las acciones de Abacus en Atajos y una
comprobación de donación de la acción. La donación no ejecuta ni guarda un gasto.
Si iOS no enumera las acciones, un atajo con **URL → Abrir URL** y el enlace de
una plantilla permite preparar el formulario; no guarda directamente.

La misma pantalla permite copiar el código de un widget financiero independiente
para **Scriptable**. Crear un script nuevo, pegar el código y ejecutarlo una vez
para configurar la dirección del servidor y un token personal de Firefly.
Esas credenciales se guardan en el llavero de Scriptable; el código copiado por
Abacus no contiene su token. HTTPS es obligatorio salvo para direcciones privadas
de la red local y nombres `.local`. No se requieren App Groups ni una cuenta de
Apple de pago para esta integración. Scriptable debe instalarse por separado.

Añadir un widget de Scriptable, elegir el script y usar como parámetro:

| Parámetro | Información |
| --- | --- |
| `daily` | Gastos, ingresos y flujo neto de hoy |
| `monthly` | Resumen del mes hasta hoy |
| `yearly` | Resumen del año |
| `accounts` | Saldos de las cuentas de activos, separados por divisa |
| `categories` | Gastos mensuales por categoría |
| `uncategorized` | Gastos del mes pendientes de clasificar |
| `trend` | Mes actual frente a los mismos días del mes anterior |

El menú del script permite ocultar los importes. Los widgets recorren todas las
páginas y conservan solo capturas completas por período. Indican la hora de la
última actualización y cuándo muestran datos guardados sin conexión. Un token
revocado se muestra como error; cambiar la conexión borra las capturas anteriores.
iOS decide cuándo actualizar: la frecuencia solicitada no garantiza actualización
inmediata. Tocar el widget abre las plantillas de Abacus Personal.

El código instalable está en `integrations/scriptable/abacus-widget.js`, generado
desde la lógica de cálculos compartida y `runtime.js`. Después de cambiar estos
archivos, ejecutar `node scripts/generate-scriptable-widget.cjs`. Comprobarlo con
`node scripts/generate-scriptable-widget.cjs --check` y
`node scripts/test-scriptable-widget.cjs`.

Los enlaces usan `abacus-personal://quick/expense?v=1` con `templateId`,
`amount`, `description`, `kind` y `requestId` opcionales. `kind` admite
`withdrawal`, `deposit` o `transfer`; ningún enlace permite guardar directamente. La ruta `quick/templates?v=1`
abre la lista. Nunca deben incluir tokens ni credenciales. La acción nativa
genera un identificador de solicitud para evitar aperturas duplicadas. Los
enlaces esperan al inicio de sesión y a que se cierre cualquier formulario
abierto. Atajos entrega las solicitudes mediante una bandeja privada de la app,
que se vacía al recibirlas en JavaScript. La cola de JavaScript se mantiene solo
durante la sesión. No se requieren enlaces universales ni App Groups.

La plantilla permite elegir gasto, ingreso o transferencia. En Atajos hay dos
acciones: **Preparar movimiento** abre el formulario y **Guardar movimiento**
envía directamente a Firefly con una plantilla obligatoria. Para guardar, elige
cuentas existentes: origen en gastos, destino en ingresos y dos cuentas distintas
en transferencias. El importe y la descripción pueden sustituirse desde Atajos.

Guardar movimiento abre Abacus para autenticar y enviar, sin mostrar el formulario.
Solo confirma éxito cuando Firefly devuelve el identificador del movimiento.
Una solicitud caduca a los 60 segundos y no se conserva tras reiniciar la app.
Los errores no se reintentan automáticamente; ante un resultado incierto, revisa
Firefly antes de repetir. Los widgets y enlaces siempre preparan el formulario.

## Compilación

La rama `feat/ios-personal-validation` ejecuta `iOS personal validation` al subir
cambios relevantes. Tras incorporar el workflow a la rama predeterminada también
puede ejecutarse manualmente. El runner
macOS con Xcode actualizado genera un IPA sin firmar; no recibe credenciales de Apple ni de Firefly.
Descargar el artefacto `abacus-probe-unsigned` en `artifacts/`.

El segundo trabajo compila la base React Native con `APP_VARIANT=personal` y
produce `abacus-personal-unsigned`. Esta variante tiene identificador y esquema
propios y las actualizaciones OTA originales desactivadas. Para instalarla:

```bash
bash scripts/ios-personal-install.sh artifacts/abacus-personal-unsigned.ipa
```

La nueva instalación requiere configurar Firefly de nuevo. Si se usa OAuth,
registrar en Firefly la URL de retorno que muestre Abacus Personal.

Si Firefly rechaza `abacus-personal://redirect` con un error de formato de
`redirect_uris`, abrir `/settings/configuration` en Firefly y añadir el protocolo
`abacus-personal` a los protocolos de URL permitidos, conservando los anteriores.
Introducir solo el protocolo, sin `://redirect`, en esa lista. Después registrar
la URL de retorno completa al crear el cliente OAuth. Este mecanismo se explica
en la [incidencia oficial de Firefly](https://github.com/firefly-iii/firefly-iii/issues/12243).
Como alternativa, crear un token de acceso personal y activar su opción en el
formulario de Abacus; ese método no necesita URL de retorno.

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
2. Añadir «Prueba de captura» desde la galería de widgets y tocar «Nuevo movimiento».
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

La identidad compilada incluye el prefijo de firma de xtool. El verificador
comprueba que los metadatos de App Intents coincidan con esa identidad. Cada
compilación usa un número de versión creciente y registra los Atajos al iniciar.

xtool añade el prefijo de identidad incondicionalmente. El instalador prepara
una copia temporal del IPA y retira un único prefijo de `CFBundleIdentifier`
en la app y el widget antes de firmar. Los metadatos de App Intents y los
ejecutables permanecen idénticos. Así, la identidad firmada vuelve a coincidir
con la compilada, sin duplicar `XTL-…`. El IPA original no se modifica.
Si está disponible la herramienta local de diagnóstico, el instalador comprueba
también el identificador y número de compilación instalados por USB.

Ejecutar `python3 scripts/test-prepare-xtool-ipa.py` para comprobar la preparación,
la identidad resultante de la firma y el rechazo de metadatos incompatibles.
