// src/data/deployDate.js — fecha del despliegue coordinado del rebranding
// moyiq (Entrega 1). Único lugar donde se fija: de aquí salen la vigencia de
// los textos legales (pages/legal/legalMeta.js: LEGAL_EFFECTIVE_DATE y
// LEGAL_VERSION) y el id de la nota de Novedades del cambio de nombre
// (data/releaseNotes.js). El plan es el 1-dic-2026, junto con la adecuación a
// la Ley 21.719 de Chile.
//
// Antes de integrar a main: poner la fecha real y borrar la línea TODO de
// abajo. `PREDEPLOY=1 npx vitest run src/data/deployDate.test.js` falla
// mientras quede.
// TODO(rebrand-deploy): fijar REBRAND_DEPLOY_DATE al día real del despliegue.
export const REBRAND_DEPLOY_DATE = '2026-12-01'
