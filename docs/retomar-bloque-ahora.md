# Retomar el bloque "Ahora" (31-oct-2026)

Mejoras tomadas de Quanto. Nada se borró: lo que salió de la vista sigue disponible, y cada cambio se puede revertir con un valor en `src/utils/uiFlags.js`.

| Interruptor | Qué cambia | En `false` |
|---|---|---|
| `quickAddCompact` | Alta rápida de una tarea: monto, fecha, categoría y ✓. El resto, en "Más opciones" | Hoja con todo a la vista y Guardar al pie |
| `quickAddRecentCats` | Categorías por uso reciente; "Otros" nunca primero | Por frecuencia |
| `quickAddEntryMemory` | La fecha elegida se mantiene 15 minutos | Siempre arranca en hoy |
| `emptyPreviews` | Vista previa en Presupuestos, Metas y Deudas | Ícono de siempre |
| `tabSlide` | Pestañas que se deslizan en el teléfono | Fundido corto |

**En "Más opciones" quedaron:** escribir en una línea, Pegar SMS, descripción, método de pago, Repetir, Se repite y Más detalles. La persona decide si queda abierto: se recuerda en `fos_qa_more_open`.

**Con `quickAddCompact` en `false`** las piezas siguen, pero el orden no es idéntico al anterior: la línea y Pegar SMS quedan bajo el teclado. También aplica al onboarding, que usa el formulario entero.

## Pendiente: inicio de mes por día de cobro
No está en este lote. La lógica del mes vive en más de 50 puntos de 29 archivos (`date.startsWith(month)`, `slice(0, 7)`), y una versión parcial daría cifras distintas entre pantallas.

Para hacerlo bien:
1. Crear una sola función que diga a qué ciclo pertenece una fecha, y pasar por ella todos esos puntos.
2. Mantener en mes calendario lo fiscal (Deducciones, APV, RESICO, Ahorro fiscal).
3. Definir cómo caen fijos, presupuestos, arrastre, proyección, IQ Score y reportes.
4. Dejar el valor por defecto en día 1, sin ningún cambio para quien no lo active.

Hacerlo después del primer cobro real (10-nov).
