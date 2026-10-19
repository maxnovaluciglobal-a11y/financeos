// La cuenta de la sesión ({ id, email }) para atar el checkout de Pro a ella
// (C-39 / PRD-2). null mientras carga, en el demo o sin sesión.
import { useEffect, useState } from 'react'
import { getSession } from '../core/auth.js'

export function useAccount() {
  const [account, setAccount] = useState(null)
  useEffect(() => {
    let alive = true
    getSession().then((s) => {
      if (alive && s?.user?.id) setAccount({ id: s.user.id, email: s.user.email || null })
    }).catch(() => {})
    return () => { alive = false }
  }, [])
  return account
}
