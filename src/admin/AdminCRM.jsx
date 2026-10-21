// src/admin/AdminCRM.jsx
// Panel CRM mínimo compartido MOY IQ + Invest (pedido de Walter, 13-sep-2026).
// Ruta separada (?admin=crm), fuera del flujo de licencia/onboarding de
// usuarios finales — ver App.jsx isAdminMode(). El acceso real lo impone la
// policy RLS de crm_contacts (auth.jwt()->>'email' = admin), no esta pantalla:
// cualquiera puede abrir la URL, pero sin loguearse con esa cuenta exacta
// Supabase devuelve 0 filas, nunca error revelador.
import { useState, useEffect, useCallback } from 'react'
import { authClient } from '../core/authClient.js'
import AuthGate from '../components/AuthGate.jsx'
import { localDateStr } from '../utils/index.js'
import { toCsv } from '../utils/csvSafe.js'
import { fuenteLabel, leadScore, todayQueue, ACTIVITY_TYPES } from './crmLogic.js'

const ESTADOS = ['nuevo', 'contactado', 'nutriendo', 'convertido', 'perdido']
const PRODUCTOS = ['moyiq', 'invest']

// `plan` lo mantiene la base (crm_refresh_contact, migración 20261018000000):
// null = sin cuenta, 'gratis' = tiene cuenta, 'pro' = paga. `estado` es la
// etapa de venta que mueve Walter a mano.
const PLAN_LABEL = { pro: 'Pro', gratis: 'Cuenta gratis' }
const fmtDate = (ts) => (ts ? new Date(ts).toLocaleDateString('es-CL') : '—')

function Row({ row, onSave, onSaveNext, onOpenDetail }) {
  const [estado, setEstado] = useState(row.estado)
  const [notas, setNotas] = useState(row.notas || '')
  const [accion, setAccion] = useState(row.proxima_accion || '')
  const [fecha, setFecha] = useState(row.proxima_accion_fecha || '')
  const [dirty, setDirty] = useState(false)
  const [nextDirty, setNextDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    if (dirty) await onSave(row.id, { estado, notas })
    if (nextDirty) await onSaveNext(row.id, accion, fecha || null)
    setSaving(false)
    setDirty(false)
    setNextDirty(false)
  }
  const overdue = row.proxima_accion_fecha && row.proxima_accion_fecha <= localDateStr()

  return (
    <tr style={{ borderBottom: '1px solid var(--bd, var(--brd))' }}>
      <td
        onClick={() => onOpenDetail(row)}
        style={{ padding: '8px 10px', fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline dotted' }}
        title="Ver detalle"
      >
        {row.email}
        {row.nombre && <div style={{ fontFamily: 'var(--sans, sans-serif)', fontSize: 11, color: 'var(--th)', textDecoration: 'none' }}>{row.nombre}</div>}
      </td>
      <td style={{ padding: '8px 10px' }}>{row.producto_origen}</td>
      <td style={{ padding: '8px 10px', fontSize: 12 }}>{fuenteLabel(row)}</td>
      <td style={{ padding: '8px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>
        {PLAN_LABEL[row.plan] || '—'}
        <div style={{ fontSize: 11, color: 'var(--tm)' }} title="Cuenta +30 · login 7 días +20 · opt-in +15 · Pro +35">
          {leadScore(row)} pts · opt-in {row.optin_confirmado ? 'sí' : 'no'}
        </div>
      </td>
      <td style={{ padding: '8px 10px' }}>
        <select
          value={estado}
          onChange={(e) => { setEstado(e.target.value); setDirty(true) }}
          style={{ fontSize: 12, padding: '4px 6px' }}
        >
          {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td style={{ padding: '8px 10px' }}>
        <input
          type="text"
          value={notas}
          onChange={(e) => { setNotas(e.target.value); setDirty(true) }}
          placeholder="Notas..."
          aria-label={`Notas de ${row.email}`}
          style={{ width: '100%', fontSize: 12, padding: '4px 6px' }}
        />
      </td>
      <td style={{ padding: '8px 10px', minWidth: 170 }}>
        <input
          type="text"
          value={accion}
          onChange={(e) => { setAccion(e.target.value); setNextDirty(true) }}
          placeholder="Próxima acción..."
          aria-label={`Próxima acción de ${row.email}`}
          style={{ width: '100%', fontSize: 12, padding: '4px 6px' }}
        />
        <input
          type="date"
          value={fecha}
          onChange={(e) => { setFecha(e.target.value); setNextDirty(true) }}
          aria-label={`Fecha de la próxima acción de ${row.email}`}
          style={{ width: '100%', fontSize: 12, padding: '4px 6px', marginTop: 4, color: overdue ? 'var(--neg)' : undefined }}
        />
      </td>
      <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--th)', whiteSpace: 'nowrap' }}>
        {fmtDate(row.creado_en)}
      </td>
      <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--th)', whiteSpace: 'nowrap' }}>
        {fmtDate(row.ultimo_contacto)}
      </td>
      <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--tm)', whiteSpace: 'nowrap' }}>
        {fmtDate(row.ultimo_login)}
      </td>
      <td style={{ padding: '8px 10px' }}>
        <button onClick={handleSave} disabled={(!dirty && !nextDirty) || saving} style={{ fontSize: 12, padding: '4px 10px' }}>
          {saving ? '...' : 'Guardar'}
        </button>
      </td>
    </tr>
  )
}

function exportRowsToCsv(rows) {
  const headers = ['email', 'nombre', 'producto_origen', 'fuente', 'plan', 'score', 'estado', 'notas', 'proxima_accion', 'proxima_accion_fecha', 'ultimo_login', 'optin_confirmado', 'lang', 'ultimo_contacto', 'creado_en']
  const csv = toCsv([headers, ...rows.map((row) => headers.map((h) => row[h]))])
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `crm_contacts_${localDateStr()}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const ESTADO_COLOR = {
  nuevo: 'var(--th)',
  contactado: 'var(--info)',
  nutriendo: 'var(--warn)',
  convertido: 'var(--pos)',
  perdido: 'var(--neg)',
}

// Barras horizontales apiladas: una por producto, cada segmento es un estado
// del funnel (nuevo→...→convertido/perdido) proporcional al total de ese
// producto. Sin librería de charts — la data ya viene agregada de
// crm_funnel (vista SQL), no hace falta más que un div por segmento.
function FunnelSummary({ funnel }) {
  if (!funnel || funnel.length === 0) return null
  const porProducto = funnel.reduce((acc, f) => {
    acc[f.producto_origen] = acc[f.producto_origen] || {}
    acc[f.producto_origen][f.estado] = f.total
    return acc
  }, {})
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
      {Object.entries(porProducto).map(([producto, estados]) => {
        const total = ESTADOS.reduce((sum, s) => sum + (estados[s] || 0), 0)
        const convertidos = estados.convertido || 0
        const tasaConversion = total > 0 ? ((convertidos / total) * 100).toFixed(1) : '0.0'
        return (
          <div key={producto} style={{ border: '1px solid var(--bd, var(--brd))', borderRadius: 6, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{producto}</span>
              <span style={{ fontSize: 11, color: 'var(--th)' }}>
                {total} contactos · {tasaConversion}% conversión
              </span>
            </div>
            <div style={{ display: 'flex', height: 18, borderRadius: 3, overflow: 'hidden', background: 'var(--brd)' }}>
              {total === 0
                ? null
                : ESTADOS.map((s) => {
                    const count = estados[s] || 0
                    if (count === 0) return null
                    return (
                      <div
                        key={s}
                        title={`${s}: ${count}`}
                        style={{ width: `${(count / total) * 100}%`, background: ESTADO_COLOR[s] }}
                      />
                    )
                  })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
              {ESTADOS.map((s) => (
                <span key={s} style={{ fontSize: 11, color: 'var(--th)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: ESTADO_COLOR[s], display: 'inline-block' }} />
                  {s}: <strong style={{ color: 'inherit' }}>{estados[s] || 0}</strong>
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Panel de detalle: se abre al hacer click en una fila y trae la fila más
// reciente de la tabla de origen del lead (qué correos de nurture recibió,
// consentimiento, baja). crm_contacts no guarda de qué tabla vino: se deduce
// de `producto_origen` y `fuente`. Lectura permitida por las policies de
// admin (migraciones 20260918000400 y 20261018000000).
function sourceTable(row) {
  if (row.producto_origen === 'invest') return 'invest_leads'
  if (row.fuente === 'starter') return 'starter_leads'
  if (row.fuente === 'demo') return 'demo_leads'
  if (row.fuente === 'calculadora') return 'tax_calculator_leads'
  if (row.fuente === 'stripe') return null
  if (!row.fuente) return null
  return 'diagnostico_leads'
}

// Historial de contactos (crm_activities). Se escribe solo por la RPC acotada
// crm_add_activity (DAT-19), igual que las tareas programadas.
function Activities({ contactId }) {
  const [items, setItems] = useState(null)
  const [tipo, setTipo] = useState('nota')
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error: err } = await authClient
      .from('crm_activities')
      .select('id, tipo, nota, creado_en, creado_por')
      .eq('contact_id', contactId)
      .order('creado_en', { ascending: false })
      .limit(50)
    if (err) { setError(err.message); setItems([]); return }
    setItems(data || [])
  }, [contactId])

  useEffect(() => { load() }, [load])

  async function add(e) {
    e.preventDefault()
    if (!nota.trim()) return
    const { error: err } = await authClient.rpc('crm_add_activity', { p_contact_id: contactId, p_nota: nota.trim(), p_tipo: tipo })
    if (err) { setError(err.message); return }
    setNota('')
    load()
  }

  return (
    <div style={{ borderTop: '1px solid var(--bd, var(--brd))', paddingTop: 14, marginBottom: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Historial</div>
      <form onSubmit={add} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de actividad" style={{ fontSize: 12, padding: '4px 6px' }}>
          {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={2000} rows={3} aria-label="Detalle de la actividad" placeholder="Qué pasó…" style={{ fontSize: 12, padding: '4px 6px' }} />
        <button type="submit" disabled={!nota.trim()} style={{ fontSize: 12, padding: '4px 10px', alignSelf: 'flex-start' }}>Agregar</button>
      </form>
      {error && <div style={{ color: 'var(--neg)', fontSize: 12, marginBottom: 6 }}>Error: {error}</div>}
      {items === null ? (
        <div style={{ fontSize: 12, color: 'var(--tm)' }}>Cargando...</div>
      ) : items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--tm)' }}>Sin actividad registrada.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((a) => (
            <li key={a.id} style={{ fontSize: 12 }}>
              <div style={{ color: 'var(--tm)' }}>{new Date(a.creado_en).toLocaleString('es-CL')} · {a.tipo}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{a.nota}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LeadDetail({ row, onClose }) {
  const [nurture, setNurture] = useState(undefined)
  const table = sourceTable(row)

  useEffect(() => {
    let cancelled = false
    if (!table) { setNurture(null); return }
    authClient
      .from(table)
      .select('*')
      .ilike('email', row.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => { if (!cancelled) setNurture(data?.[0] || null) })
    return () => { cancelled = true }
  }, [row.email, table])

  const fmt = (ts) => (ts ? new Date(ts).toLocaleString('es-CL') : null)

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop click-to-close is a mouse shortcut; keyboard users close the drawer with its Cerrar button
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'flex-end', zIndex: 50 }}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- only stops clicks inside the panel from reaching the backdrop; not a control */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 380, maxWidth: '90vw', height: '100%', background: 'var(--bg)', padding: 20, overflowY: 'auto', boxShadow: '-2px 0 12px rgba(0,0,0,0.15)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, wordBreak: 'break-all' }}>{row.email}</h2>
          <button onClick={onClose} style={{ fontSize: 12 }}>Cerrar</button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--th)', marginBottom: 4 }}>Producto</div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>{row.producto_origen}</div>

        <div style={{ fontSize: 12, color: 'var(--th)', marginBottom: 4 }}>Fuente</div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>{fuenteLabel(row)}</div>

        <div style={{ fontSize: 12, color: 'var(--th)', marginBottom: 4 }}>Cuenta</div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>
          {row.cuenta_creada_en ? `creada el ${fmtDate(row.cuenta_creada_en)} · último login ${fmtDate(row.ultimo_login)}` : 'sin cuenta'}
          {row.lang ? ` · idioma ${row.lang}` : ''}
        </div>

        <div style={{ fontSize: 12, color: 'var(--th)', marginBottom: 4 }}>Opt-in de marketing</div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>{row.optin_confirmado ? 'confirmado' : 'no confirmado'}</div>

        <div style={{ fontSize: 12, color: 'var(--th)', marginBottom: 4 }}>Próxima acción</div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>{row.proxima_accion ? `${row.proxima_accion}${row.proxima_accion_fecha ? ` · ${fmtDate(row.proxima_accion_fecha + 'T12:00:00')}` : ''}` : '—'}</div>

        {row.nombre && (
          <>
            <div style={{ fontSize: 12, color: 'var(--th)', marginBottom: 4 }}>Nombre</div>
            <div style={{ fontSize: 13, marginBottom: 12 }}>{row.nombre}</div>
          </>
        )}

        <div style={{ fontSize: 12, color: 'var(--th)', marginBottom: 4 }}>Plan</div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>{PLAN_LABEL[row.plan] || 'Sin cuenta'}</div>

        <div style={{ fontSize: 12, color: 'var(--th)', marginBottom: 4 }}>Score</div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>{row.score ?? '—'}</div>

        <div style={{ fontSize: 12, color: 'var(--th)', marginBottom: 4 }}>Último contacto</div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>{fmtDate(row.ultimo_contacto)}</div>

        <div style={{ fontSize: 12, color: 'var(--th)', marginBottom: 4 }}>Estado</div>
        <div style={{ fontSize: 13, marginBottom: 16 }}>{row.estado}</div>

        <div style={{ fontSize: 12, color: 'var(--th)', marginBottom: 4 }}>Notas</div>
        <div style={{ fontSize: 13, marginBottom: 20, whiteSpace: 'pre-wrap' }}>{row.notas || '—'}</div>

        <Activities contactId={row.id} />

        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, borderTop: '1px solid var(--bd, var(--brd))', paddingTop: 14 }}>
          Secuencia de nurture
        </div>
        {nurture === undefined ? (
          <div style={{ fontSize: 12, color: 'var(--th)' }}>Cargando...</div>
        ) : nurture === null ? (
          <div style={{ fontSize: 12, color: 'var(--th)' }}>
            {table ? `Sin registro en ${table}.` : row.fuente === 'stripe' ? 'Llegó directo por Stripe, sin lead previo.' : 'Creó la cuenta sin pasar por un formulario.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4].filter((n) => `email${n}_sent_at` in nurture).map((n) => {
              const ts = nurture[`email${n}_sent_at`]
              return (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ts ? 'var(--pos)' : 'var(--brd2)', display: 'inline-block', flexShrink: 0 }} />
                  <span>Email {n}: {fmt(ts) || 'no enviado todavía'}</span>
                </div>
              )
            })}
            {!['email1_sent_at', 'email2_sent_at'].some((k) => k in nurture) && (
              <div style={{ fontSize: 12, color: 'var(--th)' }}>Esta puerta no tiene secuencia de correos.</div>
            )}
            <div style={{ fontSize: 12, marginTop: 6, color: nurture.consent_marketing ? 'inherit' : 'var(--neg)' }}>
              Marketing: {nurture.consent_marketing === true
                ? (nurture.consent_confirmed_at ? `confirmado el ${fmt(nurture.consent_confirmed_at)}` : 'aceptado, falta confirmar el correo')
                : nurture.consent_marketing === false ? 'no aceptado — solo correos de servicio' : 'sin dato'}
            </div>
            {nurture.unsubscribed_at && (
              <div style={{ fontSize: 12, color: 'var(--neg)' }}>Se dio de baja el {fmt(nurture.unsubscribed_at)}.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Solicitudes de cancelación (cancelar.html → submit_cancellation_request).
// Stripe no se toca desde acá: Walter procesa la baja en Stripe y marca la
// solicitud. Lectura y escritura solo para admins (RLS).
const CANCEL_STATUS = { received: 'Recibida', processing: 'En proceso', done: 'Procesada', rejected: 'Rechazada' }

function Cancellations() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error: err } = await authClient
      .from('cancellation_requests')
      .select('id, created_at, name, email, plan, kind, reason, requested_date, status, processed_at')
      .order('created_at', { ascending: false })
      .limit(50)
    if (err) { setError(err.message); setItems([]); return }
    setItems(data || [])
  }, [])

  useEffect(() => { load() }, [load])

  async function setStatus(id, status) {
    const patch = { status, processed_at: status === 'done' || status === 'rejected' ? new Date().toISOString() : null }
    const { error: err } = await authClient.from('cancellation_requests').update(patch).eq('id', id)
    if (err) { setError(err.message); return }
    load()
  }

  if (items === null) return null
  const pending = items.filter((c) => c.status === 'received' || c.status === 'processing').length

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
        Solicitudes de cancelación {pending > 0 && <span style={{ color: 'var(--neg)' }}>· {pending} pendiente{pending > 1 ? 's' : ''}</span>}
      </h2>
      {error && <div style={{ color: 'var(--neg)', fontSize: 13, marginBottom: 8 }}>Error: {error}</div>}
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--th)' }}>No hay solicitudes.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--bd, var(--brd2))', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px' }}>Fecha</th>
              <th style={{ padding: '6px 8px' }}>Persona</th>
              <th style={{ padding: '6px 8px' }}>Plan</th>
              <th style={{ padding: '6px 8px' }}>Tipo</th>
              <th style={{ padding: '6px 8px' }}>Motivo</th>
              <th style={{ padding: '6px 8px' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--bd, var(--brd))' }}>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{fmtDate(c.created_at)}</td>
                <td style={{ padding: '6px 8px' }}>{c.name}<div style={{ fontFamily: 'var(--mono)', color: 'var(--th)' }}>{c.email}</div></td>
                <td style={{ padding: '6px 8px' }}>{c.plan || '—'}</td>
                <td style={{ padding: '6px 8px' }}>{c.kind}{c.requested_date ? ` · ${fmtDate(c.requested_date)}` : ''}</td>
                <td style={{ padding: '6px 8px', maxWidth: 260 }}>{c.reason || '—'}</td>
                <td style={{ padding: '6px 8px' }}>
                  <select value={c.status} onChange={(e) => setStatus(c.id, e.target.value)} style={{ fontSize: 12, padding: '4px 6px' }}>
                    {Object.entries(CANCEL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function CRMPanel({ session, onSignOut }) {
  const [rows, setRows] = useState(null)
  const [funnel, setFunnel] = useState(null)
  const [error, setError] = useState('')
  const [filtroProducto, setFiltroProducto] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [soloSinContactoReciente, setSoloSinContactoReciente] = useState(false)
  // DAT-9 (auditoría 360): las filas internas y de prueba (columna generada
  // is_internal) quedan ocultas por defecto.
  const [mostrarInternos, setMostrarInternos] = useState(false)
  const [vistaHoy, setVistaHoy] = useState(false)
  const [detailRow, setDetailRow] = useState(null)

  const load = useCallback(async () => {
    setError('')
    let query = authClient.from('crm_contacts').select('*').order('creado_en', { ascending: false })
    if (filtroProducto !== 'todos') query = query.eq('producto_origen', filtroProducto)
    if (filtroEstado !== 'todos') query = query.eq('estado', filtroEstado)
    const { data, error: err } = await query
    if (err) { setError(err.message); setRows([]); return }
    setRows(data || [])

    const { data: funnelData, error: funnelErr } = await authClient.from('crm_funnel').select('*')
    if (!funnelErr) setFunnel(funnelData || [])
  }, [filtroProducto, filtroEstado])

  useEffect(() => { load() }, [load])

  const filtered = (rows || []).filter((row) => {
    if (!mostrarInternos && row.is_internal) return false
    if (!soloSinContactoReciente) return true
    if (!row.ultimo_contacto) return true
    const dias = (Date.now() - new Date(row.ultimo_contacto).getTime()) / 86400000
    return dias >= 14
  })
  const pendientesHoy = todayQueue(filtered, localDateStr())
  const visibleRows = vistaHoy ? pendientesHoy : filtered

  async function handleSaveNext(id, accion, fecha) {
    const { error: err } = await authClient.rpc('crm_set_next_action', { p_contact_id: id, p_accion: accion, p_fecha: fecha })
    if (err) { setError(err.message); return }
    load()
  }

  async function handleSaveRow(id, patch) {
    const { error: err } = await authClient
      .from('crm_contacts')
      .update({ ...patch, actualizado_en: new Date().toISOString() })
      .eq('id', id)
    if (err) { setError(err.message); return }
    load()
  }

  return (
    <div style={{ padding: 24, fontFamily: 'var(--sans, sans-serif)', maxWidth: 1280, margin: '0 auto', overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>CRM — MOY IQ + Invest</h1>
        <div style={{ fontSize: 12, color: 'var(--th)' }}>
          {session.user.email} · <button onClick={onSignOut} style={{ fontSize: 12 }}>Salir</button>
        </div>
      </div>

      <FunnelSummary funnel={funnel} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={filtroProducto} onChange={(e) => setFiltroProducto(e.target.value)} style={{ fontSize: 12, padding: '6px 8px' }}>
          <option value="todos">Todos los productos</option>
          {PRODUCTOS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ fontSize: 12, padding: '6px 8px' }}>
          <option value="todos">Todos los estados</option>
          {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <input
            type="checkbox"
            style={{ width: 16, height: 16, flexShrink: 0 }}
            checked={vistaHoy}
            onChange={(e) => setVistaHoy(e.target.checked)}
          />
          Hoy ({pendientesHoy.length})
        </label>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            style={{ width: 16, height: 16, flexShrink: 0 }}
            checked={soloSinContactoReciente}
            onChange={(e) => setSoloSinContactoReciente(e.target.checked)}
          />
          Sin contacto hace 14+ días
        </label>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            style={{ width: 16, height: 16, flexShrink: 0 }}
            checked={mostrarInternos}
            onChange={(e) => setMostrarInternos(e.target.checked)}
          />
          Mostrar internos y de prueba
        </label>
        <button
          onClick={() => exportRowsToCsv(visibleRows)}
          disabled={visibleRows.length === 0}
          style={{ fontSize: 12, padding: '6px 10px', marginLeft: 'auto' }}
        >
          Exportar CSV
        </button>
      </div>

      {error && <div style={{ color: 'var(--neg)', fontSize: 13, marginBottom: 12 }}>Error: {error}</div>}

      {rows === null ? (
        <div style={{ fontSize: 13, color: 'var(--th)' }}>Cargando...</div>
      ) : visibleRows.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--th)' }}>{vistaHoy ? 'No hay acciones para hoy.' : 'Sin contactos con estos filtros.'}</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--bd, var(--brd2))', textAlign: 'left' }}>
              <th style={{ padding: '8px 10px' }}>Email</th>
              <th style={{ padding: '8px 10px' }}>Producto</th>
              <th style={{ padding: '8px 10px' }}>Fuente</th>
              <th style={{ padding: '8px 10px' }}>Plan</th>
              <th style={{ padding: '8px 10px' }}>Estado</th>
              <th style={{ padding: '8px 10px' }}>Notas</th>
              <th style={{ padding: '8px 10px' }}>Próxima acción</th>
              <th style={{ padding: '8px 10px' }}>Creado</th>
              <th style={{ padding: '8px 10px' }}>Últ. contacto</th>
              <th style={{ padding: '8px 10px' }}>Últ. login</th>
              <th style={{ padding: '8px 10px' }}><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => <Row key={row.id} row={row} onSave={handleSaveRow} onSaveNext={handleSaveNext} onOpenDetail={setDetailRow} />)}
          </tbody>
        </table>
      )}

      <Cancellations />

      {detailRow && <LeadDetail row={detailRow} onClose={() => setDetailRow(null)} />}
    </div>
  )
}

export default function AdminCRM() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    if (!authClient) return
    authClient.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = authClient.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub?.subscription?.unsubscribe()
  }, [])

  if (!authClient) return <div style={{ padding: 24 }}>Auth no configurado.</div>
  if (session === undefined) return null
  if (!session) return <main><AuthGate onAuthenticated={setSession} /></main>

  return <CRMPanel session={session} onSignOut={() => authClient.auth.signOut()} />
}
