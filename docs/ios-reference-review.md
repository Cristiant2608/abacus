# Referencias para mejorar Abacus en iPhone

Revisión del 26 de octubre de 2026. Abacus continúa como cliente de Firefly III;
estas referencias no implican una migración de framework ni sustituyen la
validación en un iPhone de los App Intents propios.

## Atajos importables

[dtrainych/firefly-ios-shortcuts](https://github.com/dtrainych/firefly-ios-shortcuts)
publica cuatro atajos enlazados desde su README: listar cuentas, categorías,
presupuestos y añadir movimientos. El flujo selecciona tipo, origen, destino,
descripción, importe y campos opcionales. Usa la API de Firefly con un token
personal configurado en Atajos.

Es una referencia útil para ofrecer acciones con parámetros claros y una
alternativa importable si el registro nativo de iOS sigue fallando. Esa
alternativa necesita su propia configuración de credenciales; no se debe
exportar el token guardado en Abacus dentro de un enlace o archivo compartido.
Las instrucciones antiguas sobre «Allow Untrusted Shortcuts» no deben copiarse
como instrucciones actuales de iOS. El repositorio contiene enlaces a los
atajos, no una integración App Intents que pueda corregir la firma de Abacus.

## Widgets informativos

[Neurocoda/firefly-iii-ios-widget](https://github.com/Neurocoda/firefly-iii-ios-widget),
revisado en `0794ad82adb81accbdde649197df4cdeb3b70e59`, contiene scripts para
Scriptable: gastos diarios/mensuales/anuales, balance, saldos de cuentas,
categorías, comparación de meses y movimientos sin categoría. Guarda la última
respuesta para mostrarla cuando no hay conexión, con la fecha de actualización.

Para Abacus, priorizar un resumen mensual y avisos de movimientos sin categoría,
además del widget actual de captura. Los scripts necesitan Scriptable y un token
en su configuración; no son extensiones WidgetKit reutilizables directamente.
El widget nativo actual de Abacus no comparte datos financieros con su extensión.
Un resumen actualizado exigiría diseñar ese intercambio o una vía independiente
como Scriptable, teniendo en cuenta la firma gratuita.

No copiar literalmente sus cálculos: el script mensual revisado solicita una
sola página de hasta 500 movimientos, suma con `Number` y usa un símbolo de
moneda configurado. La implementación de Abacus debe cubrir todas las páginas,
mantener precisión y separar divisas. Las transferencias no deben aumentar el
total de ingresos o gastos.

## Interfaz y robustez de la API

[Javiito32/Luzzy](https://github.com/Javiito32/Luzzy), revisado en
`a83ee5ad694748e8eba1d0e42c3e86f167024bbc`, es un cliente SwiftUI. Su inicio
agrupa patrimonio, ingresos/gastos del mes, presupuestos y movimientos recientes.
Su arquitectura incluye dinero con `Decimal`, caché por perfil, errores de API
normalizados y renovación de tokens agrupada en una única tarea compartida.

Tomar como referencia la jerarquía visual, la separación por divisa, la
presentación de errores de validación y la conservación de datos anteriores al
fallar una lectura. Los controles translúcidos deben mantener el contenido
financiero legible y respetar accesibilidad y la opción de ocultar importes.
No se ha incorporado código de este proyecto.

Sus widgets e intents de Atajos aparecen como pendientes en la hoja de ruta:
no ofrece una solución ya implementada para el registro que falla en Abacus.
La migración a SwiftUI, iCloud y la monetización quedan fuera de esta mejora.

## Orden propuesto

1. Resolver y verificar el registro nativo: identidad, metadatos, donación de
   prueba y apertura de la galería propia mediante `ShortcutsLink`.
2. Validar preparar/guardar los tres tipos de movimiento contra Firefly,
   conservando autenticación y protección contra envíos repetidos.
3. Incorporar resumen mensual, fecha de actualización y avisos de clasificación
   en una siguiente ampliación de widgets, definiendo primero la vía de datos
   compatible con la cuenta gratuita.
4. Mejorar la pantalla de inicio y los errores de API a partir de las referencias,
   manteniendo React Native y coordinando los cambios de caché/interfaz que ya
   existen en el árbol de trabajo.

## Implementación incorporada

La rama incorpora un resumen por divisa con últimos movimientos y gastos sin
categoría; widgets independientes de Scriptable para los siete modos descritos
en la guía; configuración desde Accesos rápidos; apertura oficial de la galería
de Atajos y donación de diagnóstico; errores de API normalizados; importes de
formularios enviados como cadenas decimales; y renovación de tokens compartida
entre solicitudes simultáneas. No se ha copiado código de los repositorios.

Los widgets de Scriptable comparten la lógica probada de cálculos y paginación
con Abacus. Las credenciales se configuran por separado y se guardan en el
llavero de Scriptable. El registro de App Intents requiere todavía validación
física: una compilación y unos metadatos correctos no bastan para declararlo
resuelto. La guía de uso está en [ios-personal.md](ios-personal.md).
