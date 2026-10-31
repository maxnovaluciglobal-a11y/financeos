// invest-handoff: lógica pura y llamadas a Auth, sin Deno.env, para testear en vitest.
//
// Pasar el refresh token de MOY IQ a Invest cerraría las dos sesiones: Auth rota
// el refresh token y, si la misma familia aparece en dos clientes, la revoca
// entera. Esta función entrega en cambio el `hashed_token` de un magic link que
// NO se envía por correo (generate_link no envía nada). Invest lo canjea con
// verifyOtp({ token_hash, type: 'magiclink' }) y obtiene una sesión independiente.
// El token es de un solo uso, vence según el OTP expiry de Auth y no necesita
// redirect_to: verifyOtp no redirige, así que no toca el allow-list de Auth.

export interface HandoffConfig {
  supabaseUrl: string;
  serviceRole: string;
}

export function bearerToken(header: string | null | undefined): string | null {
  const m = typeof header === "string" ? header.match(/^Bearer\s+(\S+)$/i) : null;
  return m ? m[1] : null;
}

// La cuenta de la sesión según Supabase Auth. Un token vencido, inválido o de
// otro proyecto devuelve null: la identidad sale del JWT, nunca del cuerpo.
export async function getAuthUser(
  token: string,
  config: HandoffConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ id: string; email: string | null } | null> {
  if (!token) return null;
  try {
    const res = await fetchImpl(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.serviceRole, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (typeof user?.id !== "string" || !user.id) return null;
    return { id: user.id, email: typeof user.email === "string" && user.email ? user.email : null };
  } catch {
    return null;
  }
}

// Equivale a auth.admin.generateLink({ type: 'magiclink', email }) sin cargar
// supabase-js (el resto de las funciones también llama a Auth con fetch). La
// respuesta trae `hashed_token` en la raíz; supabase-js lo mueve a `properties`.
export async function generateHandoffToken(
  email: string,
  config: HandoffConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const res = await fetchImpl(`${config.supabaseUrl}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.serviceRole,
        Authorization: `Bearer ${config.serviceRole}`,
      },
      body: JSON.stringify({ type: "magiclink", email }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const hashed = body?.hashed_token ?? body?.properties?.hashed_token;
    return typeof hashed === "string" && hashed ? hashed : null;
  } catch {
    return null;
  }
}

export type HandoffResult =
  | { status: 200; body: { ok: true; token_hash: string; uid: string } }
  | { status: 401 | 422 | 502; body: { ok: false; error: string } };

export async function createHandoff(
  authorization: string | null,
  config: HandoffConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<HandoffResult> {
  const token = bearerToken(authorization);
  const user = token ? await getAuthUser(token, config, fetchImpl) : null;
  if (!user) return { status: 401, body: { ok: false, error: "session_required" } };
  if (!user.email) return { status: 422, body: { ok: false, error: "no_email" } };
  const hashed = await generateHandoffToken(user.email, config, fetchImpl);
  if (!hashed) return { status: 502, body: { ok: false, error: "link_failed" } };
  return { status: 200, body: { ok: true, token_hash: hashed, uid: user.id } };
}
