// src/core/authClient.js
// Cliente Supabase dedicado al login obligatorio (src/core/auth.js + AuthGate).
// A propósito NO es el mismo cliente/flag que src/core/supabase.js (CLOUD_ENABLED):
// ese sigue apagado — es el stub del sync en la nube, una feature aparte, todavía
// sin activar. Mezclarlos habría encendido el sync como efecto secundario de
// agregar login, sin que nadie lo haya pedido ni probado.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export const AUTH_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON)

export const authClient = AUTH_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null
