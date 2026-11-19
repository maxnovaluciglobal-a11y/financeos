// src/hooks/useInvestAccess.js — ¿puede esta persona ver Inversiones?
// Estados (utils/investProfile.js): granted · needs-profile · no-account · loading.
// El demo siempre entra con datos de ejemplo. Un cambio de sesión (iniciar o
// cerrar sesión, guardar el perfil) se refleja solo, por onAuthStateChange.
import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { authClient } from '../core/authClient.js'
import { buildProfile, investAccessState, PROFILE_KEY, readProfile } from '../utils/investProfile.js'
import { logRejection } from '../utils/errorLog.js'

// Un solo pedido de sesión compartido por los componentes montados a la vez.
let cachedUser
const subs = new Set()
function publish(user) {
  cachedUser = user
  for (const fn of subs) fn(user)
}

export function useInvestAccess() {
  const { settings = {} } = useApp() || {}
  const demo = !!settings.isDemo
  const [user, setUser] = useState(cachedUser)
  const [loaded, setLoaded] = useState(cachedUser !== undefined)

  useEffect(() => {
    if (demo) return undefined
    const onUser = (u) => { setUser(u); setLoaded(true) }
    subs.add(onUser)
    let unsub = null
    if (!authClient) publish(null)
    else {
      if (cachedUser === undefined) {
        authClient.auth.getSession()
          .then(({ data }) => publish(data?.session?.user || null))
          .catch((e) => { logRejection('useInvestAccess:session')(e); publish(null) })
      }
      const { data } = authClient.auth.onAuthStateChange((_ev, session) => publish(session?.user || null))
      unsub = () => data?.subscription?.unsubscribe()
    }
    return () => { subs.delete(onUser); unsub?.() }
  }, [demo])

  const saveProfile = useCallback(async (answers) => {
    if (!authClient) throw new Error('auth_unavailable')
    const profile = buildProfile(answers)
    const { data, error } = await authClient.auth.updateUser({ data: { [PROFILE_KEY]: profile } })
    if (error) throw new Error(error.message || 'profile_save_failed')
    if (data?.user) publish(data.user)
    return profile
  }, [])

  const status = investAccessState({ demo, sessionLoaded: loaded, user })
  return { status, demo, profile: demo ? null : readProfile(user), saveProfile }
}

// Solo para pruebas.
export function __resetInvestAccess() { cachedUser = undefined; subs.clear() }
