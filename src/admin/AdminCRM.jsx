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

const ESTADOS = ['nuevo', 'contactado', 'nutriendo', 'convertido', 'perdido']
const PRODUCTOS = ['moyiq', 'invest']

function Row({ row, onSave, onOpenDetail }) {
  const [estado, setEstado] = useState(row.estado)
  const [notas, setNotas] = useState(row.notas || '')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(row.id, { estado, notas })
    setSaving(false)
    setDirty(false)
  }

  return (
    <tr style={{ borderBottom: '1px solid var(--bd, #e5e5e5)' }}>
      <td
        onClick={() => onOpenDetail(row)}
        style={{ padding: '8px 10px', fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline dotted' }}
        title="Ver detalle"
      >
        {row.email}
      </td>
      <td style={{ padding: '8px 10px' }}>{row.producto_origen}</td>
      <td style={{ padding: '8px 10px', fontSize: 12 }}>{row.fuente || '—'}</td>
      <td style={{ padding: '8px 10px', textAlign: 'center' }}>{row.score ?? '—'}</td>
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
          style={{ width: '100%', fontSize: 12, padding: '4px 6px' }}
        />
      </td>
      <td style={{ padding: '8px 10px', fontSize: 11, color: '#888' }}>
        {row.creado_en ? new Date(row.creado_en).toLocaleDateString('es-CL') : '—'}
      </td>
      <td style={{ padding: '8px 10px' }}>
        <button onClick={handleSave} disabled={!dirty || saving} style={{ fontSize: 12, padding: '4px 10px' }}>
          {saving ? '...' : 'Guardar'}
        </button>
      </td>
    </tr>
  )
}

function exportRowsToCsv(rows) {
  const headers = ['email', 'producto_origen', 'fuente', 'score', 'estado', 'notas', 'ultimo_contacto', 'creado_en']
  const escapeCsv = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h])).join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `crm_contacts_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const ESTADO_COLOR = {
  nuevo: '#94a3b8',
  contactado: '#60a5fa',
  nutriendo: '#f59e0b',
  convertido: '#22c55e',
  perdido: '#ef4444',
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
          <div key={producto} style={{ border: '1px solid var(--bd, #e5e5e5)', borderRadius: 6, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{producto}</span>
              <span style={{ fontSize: 11, color: '#888' }}>
                {total} contactos · {tasaConversion}% conversión
              </span>
            </div>
            <div style={{ display: 'flex', height: 18, borderRadius: 3, overflow: 'hidden', background: '#eee' }}>
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
                <span key={s} style={{ fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
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

// Panel de detalle: se abre al hacer click en una fila. Trae el registro
// crudo de diagnostico_leads (email1/2/3_sent_at) para mostrar qué parte de
// la secuencia de nurture ya recibió ese lead — dato que no vive en
// crm_contacts, solo en la tabla de origen del diagnóstico.
// crm_contacts no distingue de qué tabla de origen viene cada lead de MOY IQ
// — hay dos posibles (diagnostico_leads o starter_leads, ver migración
// 20260918000400), diferenciadas acá por `fuente` ('starter' vs cualquier
// otra cosa == vino del diagnóstico).
function LeadDetail({ row, onClose }) {
  const [nurture, setNurture] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    if (row.producto_origen !== 'moyiq') { setNurture(null); return }
    const table = row.fuente === 'starter' ? 'starter_leads' : 'diagnostico_leads'
    const cols = row.fuente === 'starter'
      ? 'email1_sent_at, email2_sent_at, email3_sent_at, created_at'
      : 'score, label, consent_marketing, email1_sent_at, email2_sent_at, email3_sent_at, creado_en'
    authClient
      .from(table)
      .select(cols)
      .eq('email', row.email)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setNurture(data || null) })
    return () => { cancelled = true }
  }, [row.email, row.producto_origen, row.fuente])

  const fmt = (ts) => (ts ? new Date(ts).toLocaleString('es-CL') : null)

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'flex-end', zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 380, maxWidth: '90vw', height: '100%', background: 'var(--bg, #fff)', padding: 20, overflowY: 'auto', boxShadow: '-2px 0 12px rgba(0,0,0,0.15)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, wordBreak: 'break-all' }}>{row.email}</h2>
          <button onClick={onClose} style={{ fontSize: 12 }}>Cerrar</button>
        </div>

        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Producto</div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>{row.producto_origen}</div>

        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Fuente</div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>{row.fuente || '—'}</div>

        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Score</div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>{row.score ?? '—'}</div>

        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Estado</div>
        <div style={{ fontSize: 13, marginBottom: 16 }}>{row.estado}</div>

        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Notas</div>
        <div style={{ fontSize: 13, marginBottom: 20, whiteSpace: 'pre-wrap' }}>{row.notas || '—'}</div>

        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, borderTop: '1px solid var(--bd, #e5e5e5)', paddingTop: 14 }}>
          Secuencia de nurture
        </div>
        {row.producto_origen !== 'moyiq' ? (
          <div style={{ fontSize: 12, color: '#888' }}>Invest todavía no tiene nurture automático.</div>
        ) : nurture === undefined ? (
          <div style={{ fontSize: 12, color: '#888' }}>Cargando...</div>
        ) : nurture === null ? (
          <div style={{ fontSize: 12, color: '#888' }}>Sin registro en diagnostico_leads (¿no vino del diagnóstico?).</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map((n) => {
              const ts = nurture[`email${n}_sent_at`]
              return (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ts ? '#22c55e' : '#ddd', display: 'inline-block', flexShrink: 0 }} />
                  <span>Email {n}: {fmt(ts) || 'no enviado todavía'}</span>
                </div>
              )
            })}
            {nurture.consent_marketing === false && (
              <div style={{ fontSize: 11, color: '#c00', marginTop: 4 }}>Sin consentimiento de marketing — no recibe nurture.</div>
            )}
          </div>
        )}
      </div>
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

  const visibleRows = (rows || []).filter((row) => {
    if (!soloSinContactoReciente) return true
    if (!row.ultimo_contacto) return true
    const dias = (Date.now() - new Date(row.ultimo_contacto).getTime()) / 86400000
    return dias >= 14
  })

  async function handleSaveRow(id, patch) {
    const { error: err } = await authClient
      .from('crm_contacts')
      .update({ ...patch, actualizado_en: new Date().toISOString() })
      .eq('id', id)
    if (err) { setError(err.message); return }
    load()
  }

  return (
    <div style={{ padding: 24, fontFamily: 'var(--sans, sans-serif)', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>CRM — MOY IQ + Invest</h1>
        <div style={{ fontSize: 12, color: '#888' }}>
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
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={soloSinContactoReciente}
            onChange={(e) => setSoloSinContactoReciente(e.target.checked)}
          />
          Sin contacto hace 14+ días
        </label>
        <button
          onClick={() => exportRowsToCsv(visibleRows)}
          disabled={visibleRows.length === 0}
          style={{ fontSize: 12, padding: '6px 10px', marginLeft: 'auto' }}
        >
          Exportar CSV
        </button>
      </div>

      {error && <div style={{ color: '#c00', fontSize: 13, marginBottom: 12 }}>Error: {error}</div>}

      {rows === null ? (
        <div style={{ fontSize: 13, color: '#888' }}>Cargando...</div>
      ) : visibleRows.length === 0 ? (
        <div style={{ fontSize: 13, color: '#888' }}>Sin contactos con estos filtros.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--bd, #ccc)', textAlign: 'left' }}>
              <th style={{ padding: '8px 10px' }}>Email</th>
              <th style={{ padding: '8px 10px' }}>Producto</th>
              <th style={{ padding: '8px 10px' }}>Fuente</th>
              <th style={{ padding: '8px 10px' }}>Score</th>
              <th style={{ padding: '8px 10px' }}>Estado</th>
              <th style={{ padding: '8px 10px' }}>Notas</th>
              <th style={{ padding: '8px 10px' }}>Creado</th>
              <th style={{ padding: '8px 10px' }}></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => <Row key={row.id} row={row} onSave={handleSaveRow} onOpenDetail={setDetailRow} />)}
          </tbody>
        </table>
      )}

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
  if (!session) return <AuthGate onAuthenticated={setSession} />

  return <CRMPanel session={session} onSignOut={() => authClient.auth.signOut()} />
}
