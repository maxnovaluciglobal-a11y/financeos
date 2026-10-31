// src/core/supabaseStubs/realtime.js
// V4: reemplaza a @supabase/realtime-js en el build (alias en vite.config.js).
// La app usa Supabase solo para auth, tablas y RPC: ningún canal, así que el
// cliente real (más phoenix, ~60 kB minificados) nunca abría un socket. Solo
// tiene que existir lo que supabase-js llama por su cuenta: setAuth() en cada
// cambio de sesión. supabaseStubs.test.js falla si una versión nueva de
// supabase-js empieza a usar otro método. Para usar Realtime de verdad: quitar
// el alias de vite.config.js.
const unavailable = () => { throw new Error('Supabase Realtime no está en el bundle: ver src/core/supabaseStubs/realtime.js') }

export class RealtimeClient {
  setAuth() { return Promise.resolve() }
  getChannels() { return [] }
  channel() { return unavailable() }
  removeChannel() { return Promise.resolve('ok') }
  removeAllChannels() { return Promise.resolve([]) }
}
