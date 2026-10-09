// src/components/ui/Toast.jsx
import { useApp } from '../../context/AppContext.jsx'
import SignalIcon, { InlineIcon } from '../icons/SignalIcon.jsx'

export default function Toast() {
  const { toast, dismissToast } = useApp()
  if (!toast) return null

  const isError = toast.type === 'error'
  const action = toast.action

  return (
    <div
      role="status"
      aria-live="polite"
      className="fos-toast"
      style={{
        position: 'fixed',
        // Encima de la barra anclada y del "+" (R03): en escritorio las dos
        // variables valen 0 y queda a 20px del borde como antes.
        bottom: 'max(calc(20px + env(safe-area-inset-bottom)), calc(var(--tabbar-h) + var(--fab-clear) + 12px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: action ? '10px 12px 10px 16px' : '11px 18px',
        borderRadius: 10,
        fontSize: 13,
        fontFamily: 'var(--sans)',
        fontWeight: 500,
        background: isError ? 'var(--neg)' : 'var(--brand, var(--grn))',
        color: '#fff',
        boxShadow: 'var(--sh-3, 0 8px 24px rgba(0,0,0,.25))',
        maxWidth: 'min(92vw, 420px)',
        animation: 'fos-toast-in var(--dur-surface-enter, 220ms) var(--ease, ease) both',
      }}
    >
      <span><InlineIcon kind={isError ? 'alert' : 'ok'} size={14} />{toast.msg}</span>
      {action && (
        <button
          type="button"
          onClick={() => { action.onAction?.(); dismissToast?.() }}
          style={{
            flexShrink: 0,
            background: 'rgba(255,255,255,.18)',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            padding: '6px 12px',
            fontSize: 12.5,
            fontWeight: 700,
            fontFamily: 'var(--sans)',
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
      <style>{`
        @keyframes fos-toast-in { from { opacity:0; transform:translateX(-50%) translateY(8px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }
        @media (prefers-reduced-motion: reduce) {
          .fos-toast { animation: fos-toast-fade 200ms ease both !important; }
        }
        @keyframes fos-toast-fade { from { opacity:0 } to { opacity:1 } }
      `}</style>
    </div>
  )
}
