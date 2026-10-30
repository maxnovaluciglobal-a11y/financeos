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
  // V3: 10 íconos nuevos; el resto de las claves reusa los de arriba (el
  // componente va en la carga inicial y el presupuesto es de 300 kB gzip).
  CreditCard, Receipt, Truck, Megaphone, HeartHandshake, Utensils, Coins, HandCoins, Scissors, Smartphone,
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

// V3 (30-oct-2026): las categorías de las plantillas y las que escribe el
// usuario ("Mascotas", "Educación hijos", "Proveedores", "Pago tarjeta
// crédito"…) caían todas en Wallet. Ahora, si no hay coincidencia exacta, se
// busca por palabra clave (sin tildes ni mayúsculas, es/pt/en/de). Cada clave
// tiene que empezar una palabra; con "=" adelante tiene que ser la palabra
// entera ("=bus" no matchea "business", "=tax" no matchea "taxi"). El
// orden importa: lo más específico primero ("tarjeta" antes que "crédito",
// "impuesto" antes que "negocio"). Wallet queda solo para lo genérico.
export const CATEGORY_KEYWORDS = [
  [CreditCard, ['tarjeta', 'credit card', 'cartao', 'kreditkarte']],
  [House, ['hipotec', 'mortgage', 'vivienda', 'moradia', '=casa', 'casas', 'hogar', 'home', 'housing', 'wohn', 'miete', 'mueble', 'furniture', 'decoraci', 'movel', 'mobel', 'mantenci', 'mantenimiento', 'reparaci', 'repair', 'manutencao', 'reparatur']],
  [KeyRound, ['arriendo', 'alquiler', 'aluguel', '=rent', 'rental']],
  [Receipt, ['impuesto', '=tax', 'taxes', 'imposto', 'tribut', 'steuer', '=iva', '=sii', 'seniat']],
  [Truck, ['proveedor', 'supplier', 'fornecedor', 'lieferant', 'insumo', 'inventario', 'mercaderia']],
  [Megaphone, ['marketing', 'publicidad', 'publicidade', 'advertis', '=ads', 'werbung']],
  [Briefcase, ['consultor', 'consulting', 'asesoria', 'beratung', 'proyecto', 'project', 'projeto', 'projekt', 'cliente', 'client', 'kunde', 'retainer', 'iguala']],
  [AppWindow, ['plataforma', 'platform', 'digital', 'online', '=web']],
  [Laptop, ['tecnolog', 'technolog', 'technik', 'computador', 'computer', 'laptop', 'notebook']],
  [Smartphone, ['telefono', 'celular', '=movil', 'phone', 'handy', 'mobile']],
  [GraduationCap, ['educa', 'estudi', 'curso', 'colegio', 'escuela', 'universi', 'school', 'tuition', 'course', 'escola', 'bildung', 'schule', 'kurs']],
  [PawPrint, ['mascota', '=pet', 'pets', 'perro', 'gato', 'veterin', 'haustier', 'tierarzt']],
  [HeartPulse, ['salud', 'saude', 'health', 'medic', 'doctor', 'clinica', 'dentist', 'gesundheit', 'arzt', 'farmacia', 'pharmacy', 'remedio', 'apotheke']],
  [Shield, ['seguro', 'insurance', 'versicherung']],
  [PiggyBank, ['ahorro', 'saving', 'poupanca', 'spar', 'reserva', 'colchon']],
  [TrendingUp, ['inversi', 'invest', 'utilidad', 'profit', 'lucro', 'gewinn', 'dividend', 'interes', 'interest', 'zins']],
  [HandCoins, ['credito', 'prestamo', 'loan', 'emprestimo', 'kredit', 'darlehen', 'deuda', 'debt', 'divida', 'cuota', 'schulden']],
  [Landmark, ['banco', 'bank', 'comision', '=fee', 'fees', 'gebuhr']],
  [Briefcase, ['salario', 'sueldo', 'salary', 'wage', 'payroll', 'nomina', 'gehalt', 'lohn', 'profesional', 'professional', 'honorario']],
  [Scissors, ['belleza', 'beauty', 'peluquer', 'barber', 'cuidado personal', 'servicios personales', 'beleza', 'friseur']],
  [Lightbulb, ['servicio', 'servico', 'utilit', 'basico', 'internet', 'wifi', 'fibra', 'luz', 'electric', 'energia', 'strom', 'agua', 'water', 'wasser']],
  [Store, ['emprend', 'startup', 'empreend', 'venta', 'sales', 'venda', 'verkauf', 'umsatz', 'negocio', 'business', 'empresa', 'company', 'comercio', 'tienda', 'loja', 'geschaft', 'operativ', 'oficina', 'office']],
  [HeartHandshake, ['ayuda', 'familia', 'family', 'apoyo', 'remesa', 'donaci', 'doacao', 'charity', 'spende', 'diezmo', 'ofrenda', 'bebe', 'baby', 'guarderia', 'panal', '=kita']],
  [Gift, ['regalo', 'gift', 'presente', 'geschenk', 'bono', 'bonus', 'aguinaldo']],
  [Coins, ['ingreso', 'income', 'renda', 'receita', 'extra', 'einkommen', 'einnahme']],
  [Utensils, ['comida', 'restaurant', 'almuerzo', 'cena', 'food', 'meal', 'refeicao', 'essen', 'cafe', 'coffee', 'kaffee', 'snack']],
  [ShoppingCart, ['aliment', 'supermerc', 'mercado', 'grocer', 'compras', 'lebensmittel']],
  [Car, ['transport', '=auto', 'autos', 'automovil', 'automovel', 'carro', 'coche', 'vehic', '=car', 'cars', '=moto', 'estacionamiento', 'parking', 'gasolina', 'combustible', 'fuel', 'nafta', 'benzin', 'tanken', '=bus', 'metro', 'pasaje', 'onibus', 'taxi', 'uber', 'peaje']],
  [Plane, ['viaje', 'travel', 'viagem', 'vacacion', 'ferias', 'reise', 'urlaub', 'vuelo', 'flight', 'hotel']],
  [Tv, ['streaming', 'netflix', 'disney', '=hbo', 'youtube']],
  [Music, ['musica', 'music', 'spotify']],
  [Clapperboard, ['entreten', 'ocio', 'diversion', 'lazer', 'entertain', 'leisure', 'freizeit', 'unterhaltung', 'salida', 'juego', 'game', 'jogo', 'spiel', 'cine', 'cinema', 'concierto', 'evento', 'kino']],
  [Dumbbell, ['deporte', 'gimnasio', 'gym', 'sport', 'esporte', 'fitness']],
  [Shirt, ['ropa', 'roupa', 'cloth', 'vestuario', 'calzado', 'zapato', 'kleidung']],
  [Repeat, ['suscrip', 'subscription', 'assinatura', '=abo', 'abonnement', 'mensualidad']],
  [Package, ['otro', 'otros', 'other', 'outro', 'outros', 'sonstig', 'varios', 'misc']],
]

export function normalizeCategory(s) {
  return String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

// Ícono por palabra clave, o null si nada coincide (pura, testeable).
export function iconByKeyword(category) {
  const n = normalizeCategory(category)
  if (!n.trim()) return null
  for (const [Icon, keys] of CATEGORY_KEYWORDS) {
    for (const raw of keys) {
      const whole = raw.startsWith('=')
      const k = whole ? raw.slice(1) : raw
      for (let at = n.indexOf(k); at >= 0; at = n.indexOf(k, at + 1)) {
        const startsWord = at === 0 || !/[a-z0-9]/.test(n[at - 1])
        const endsWord = !whole || at + k.length === n.length || !/[a-z0-9]/.test(n[at + k.length])
        if (startsWord && endsWord) return Icon
      }
    }
  }
  return null
}

// Tinte estable por nombre (no cambia con el ícono: una categoría libre
// conserva el color que ya tenía).
function stableSlot(category) {
  let h = 0
  for (const ch of String(category || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return FREE_SLOTS[h % FREE_SLOTS.length]
}

// Exacta → palabra clave → Wallet (solo lo genérico).
export function categoryVisual(category) {
  const hit = CATEGORY_ICONS[category]
  if (hit) return { Icon: hit[0], slot: hit[1] }
  return { Icon: iconByKeyword(category) || Wallet, slot: stableSlot(category) }
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
