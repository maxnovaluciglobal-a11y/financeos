// src/core/supabaseStubs/storage.js
// V4: reemplaza a @supabase/storage-js en el build (alias en vite.config.js).
// La app no usa Supabase Storage. supabase-js crea el cliente en su constructor
// sin llamarlo, así que alcanza con que exista. Ver realtime.js.
export class StorageApiError extends Error {}

export class StorageClient {
  from() { throw new Error('Supabase Storage no está en el bundle: ver src/core/supabaseStubs/storage.js') }
}
