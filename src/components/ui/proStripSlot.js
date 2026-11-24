// src/components/ui/proStripSlot.js — dónde va la franja "Función Pro" del demo.
//
// QA pre-tiendas (23-nov-2026, I10): ProGate la ponía ARRIBA de la página, pero
// en el teléfono la escena morada del título (PageScene) sube bajo la barra
// superior asumiendo que es lo primero: tapaba la mitad de la franja y la
// barra quedaba en modo "sobre morado" con el "‹ Atrás" blanco sobre blanco.
// Ahora, si dentro de la puerta hay un encabezado de página (PageHead), éste
// reclama la franja y la pinta debajo del título; si no hay, va arriba como antes.
import { createContext } from 'react'

export const ProStripSlot = createContext(null)
