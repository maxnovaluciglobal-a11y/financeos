// src/hooks/useSpeechEntry.js — dictado con la Web Speech API (19-nov-2026).
// Safari (iOS 14.5+) y Chrome exponen webkitSpeechRecognition. Ojo con la
// privacidad: los dos navegadores pueden mandar el audio a sus servidores
// (Apple, Google) para transcribirlo; la app solo recibe el texto y lo
// interpreta en el dispositivo (utils/voiceEntry.js). Lo dice la pantalla.
import { useCallback, useEffect, useRef, useState } from 'react'

export function speechRecognitionCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}
export const speechSupported = () => !!speechRecognitionCtor()

// error de la API → clave de texto (qa.voice.err.*)
export function speechErrorKey(code) {
  if (code === 'not-allowed') return 'denied'
  if (code === 'service-not-allowed') return 'service'
  if (code === 'no-speech' || code === 'aborted') return 'noSpeech'
  if (code === 'network') return 'network'
  if (code === 'audio-capture') return 'mic'
  return 'generic'
}

/**
 * state: 'idle' | 'listening' | 'error'
 * onFinal(texto) se llama una vez por dictado con la mejor transcripción.
 */
export function useSpeechEntry({ lang, onFinal }) {
  const [state, setState] = useState('idle')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState(null)
  const recRef = useRef(null)
  const finalRef = useRef('')
  const midRef = useRef('')   // Safari a veces cierra sin marcar isFinal
  const cb = useRef(onFinal)
  cb.current = onFinal

  const stop = useCallback(() => { try { recRef.current?.stop() } catch { /* ya terminó */ } }, [])

  const start = useCallback(() => {
    const Ctor = speechRecognitionCtor()
    if (!Ctor || recRef.current) return
    let rec
    try { rec = new Ctor() } catch { setState('error'); setError('generic'); return }
    rec.lang = lang
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1
    finalRef.current = ''; midRef.current = ''
    setInterim(''); setError(null); setState('listening')
    rec.onresult = (e) => {
      let fin = '', mid = ''
      for (let i = 0; i < e.results.length; i++) {
        const txt = e.results[i][0]?.transcript || ''
        if (e.results[i].isFinal) fin += txt; else mid += txt
      }
      if (fin) finalRef.current = fin
      else if (mid) midRef.current = mid
      setInterim((fin || mid).trim())
    }
    rec.onerror = (e) => { setError(speechErrorKey(e?.error)); setState('error') }
    rec.onend = () => {
      recRef.current = null
      const text = (finalRef.current || midRef.current || '').trim()
      setState(s => (s === 'error' ? 'error' : 'idle'))
      if (text) cb.current?.(text)
    }
    recRef.current = rec
    try { rec.start() } catch { recRef.current = null; setState('error'); setError('generic') }
  }, [lang])

  useEffect(() => () => { try { recRef.current?.abort() } catch { /* nada que cortar */ } }, [])

  return { supported: speechSupported(), state, interim, error, start, stop }
}
