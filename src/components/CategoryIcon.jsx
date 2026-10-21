// src/components/CategoryIcon.jsx — un solo sistema de ícono de categoría (UI-M4)
//
// Antes cada fila llevaba punto de color + emoji (doble codificación). Ahora:
// un ícono lucide monocromo (trazo 1,7) dentro de un cuadrado de 28 px con el
// tinte de su color categórico (--cat-n) al 12 %. Sin punto de color.
// Si el usuario activó "Emoji en las categorías" en Ajustes
// (settings.showCategoryEmoji), el cuadrado lleva el emoji en vez del ícono.
// El nombre de la categoría siempre va en texto al lado: el ícono es decorativo.

import { useContext } from 'react'
import {
  House, ShoppingCart, Car, HeartPulse, GraduationCap, Clapperboard, Lightbulb, Shirt,
  Laptop, PawPrint, Building2, TrendingUp, Package, Dumbbell, Plane, Briefcase, Code,
  KeyRound, Gift, Landmark, Store, PiggyBank, Wallet, Tv, Music, AppWindow, Shield, Cloud,
  Bike, Repeat, ListChecks,
} from 'lucide-react'
import { AppContext } from '../context/AppContext.jsx'
import { catEmoji } from '../utils/index.js'

// [ícono, índice de --cat-n]. --cat-6 (rojo error) no se usa: una categoría
// de gasto no es un error (UI-Q4).
export const CATEGORY_ICONS = {
  Vivienda: [House, 1], Alimentación: [ShoppingCart, 3], Transporte: [Car, 2], Salud: [HeartPulse, 5],
  Educación: [GraduationCap, 7], Entretención: [Clapperboard, 8], Entretenimiento: [Clapperboard, 8],
  Servicios: [Lightbulb, 4], Ropa: [Shirt, 8], Tecnología: [Laptop, 1], Mascota: [PawPrint, 4],
  Propiedad: [Building2, 1], Inversión: [TrendingUp, 3], Otros: [Package, 7], Otro: [Package, 7],
  Deporte: [Dumbbell, 3], Viajes: [Plane, 2], Ahorro: [PiggyBank, 3],
  Salario: [Briefcase, 3], Freelance: [Code, 5], Arriendo: [KeyRound, 2], Bono: [Gift, 3],
  Pensión: [Landmark, 5], 'Negocio propio': [Store, 2],
  Streaming: [Tv, 5], Música: [Music, 8], Software: [AppWindow, 1], Gimnasio: [Dumbbell, 3],
  Seguro: [Shield, 4], Cloud: [Cloud, 5], Delivery: [Bike, 2], Suscripción: [Repeat, 1], Productividad: [ListChecks, 7],
}
const FREE_SLOTS = [1, 2, 3, 4, 5, 7, 8]

// Categoría libre (escrita por el usuario): índice estable por su nombre.
export function categoryVisual(category) {
  const hit = CATEGORY_ICONS[category]
  if (hit) return { Icon: hit[0], slot: hit[1] }
  let h = 0
  for (const ch of String(category || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return { Icon: Wallet, slot: FREE_SLOTS[h % FREE_SLOTS.length] }
}

export default function CategoryIcon({ category, size = 28 }) {
  const ctx = useContext(AppContext)
  const { Icon, slot } = categoryVisual(category)
  const emoji = ctx?.settings?.showCategoryEmoji === true ? catEmoji(category) : ''
  return (
    <span aria-hidden="true" className="cat-icon" style={{
      width: size, height: size,
      background: `color-mix(in srgb, var(--cat-${slot}) 12%, transparent)`,
    }}>
      {emoji
        ? <span style={{ fontSize: Math.round(size * 0.55), lineHeight: 1 }}>{emoji}</span>
        : <Icon size={Math.round(size * 0.57)} strokeWidth={1.7} />}
    </span>
  )
}
