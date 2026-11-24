// Lecturas de medias para Oportunidades: una historia diaria de 1 año por
// activo (investApi, caché en memoria de 5 min compartida con Resumen y la
// ficha), de a 4 en paralelo. En el demo, demoMarketApi: datos reales y, si
// una pieza no responde, la de ejemplo marcada (isSample). Nada se guarda en
// el dispositivo.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { investApi } from '../../../core/investApi.js'
import { demoMarketApi, isSample } from '../../../demo/demoMarketApi.js'
import { historySymbol, runLimited } from '../../../utils/investHoy.js'
import { readSignal } from './signals.js'

export function useReadings({ demo = false, items = [] } = {}) {
  const api = demo ? demoMarketApi : investApi
  const key = items.map(i => `${i.t}:${i.type || ''}`).join(',')
  const list = useMemo(() => items, [key]) // eslint-disable-line react-hooks/exhaustive-deps -- la clave resume la lista
  const [st, setSt] = useState({ key: '', phase: 'idle', readings: {}, sample: [] })
  const [retry, setRetry] = useState(0)
  const run = useRef(0)

  useEffect(() => {
    if (!list.length) { setSt({ key, phase: 'ready', readings: {}, sample: [] }); return undefined }
    const my = ++run.current
    setSt(s => ({ key, phase: 'loading', readings: s.key === key ? s.readings : {}, sample: [] }))
    runLimited(list.map(it => async () => {
      const rows = await api.history(historySymbol(it), '1y', '1d')
      return rows
    }), 4, () => my === run.current).then(out => {
      if (my !== run.current) return
      const readings = {}
      const sample = []
      list.forEach((it, i) => {
        const rows = out[i]
        readings[it.t] = rows ? readSignal(rows.map(r => r.close), { crypto: it.type === 'Crypto' }) : null
        if (rows && isSample(rows)) sample.push(it.t)
      })
      const failed = out.every(r => r == null)
      setSt({ key, phase: failed ? 'error' : 'ready', readings, sample })
    })
    const ref = run
    return () => { ref.current++ }
  }, [api, list, key, retry])

  const reload = useCallback(() => setRetry(n => n + 1), [])
  return { ...st, reload }
}
