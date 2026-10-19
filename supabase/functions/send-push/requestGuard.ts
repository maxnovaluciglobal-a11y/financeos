// Quién puede disparar send-push (auditoría 360, C-45). La función manda el lote
// de avisos de fin de prueba y no lee el cuerpo, así que antes cualquier request
// que pasara el gateway lo ejecutaba. Un OPTIONS sin ninguna clave lo pasaba
// (el gateway deja pasar el preflight) y corría el envío completo. Ahora:
// OPTIONS no hace nada, solo POST, y solo con el x-cron-secret de pg_cron.
import { secretEquals } from "../_shared/secretEquals.ts";

export function guardPushRequest(
  method: string,
  cronSecretHeader: string | null,
  cronSecret: string | undefined,
): { status: number; error: string } | null {
  if (method === "OPTIONS") return { status: 204, error: "" };
  if (method !== "POST") return { status: 405, error: "method_not_allowed" };
  if (!secretEquals(cronSecretHeader, cronSecret)) return { status: 401, error: "unauthorized" };
  return null;
}
