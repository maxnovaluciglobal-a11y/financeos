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

function Row({ row, onSave }) {
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
      <td style={{ padding: '8px 10px', fontFamily: 'var(--mono)', fontSize: 12 }}>{row.email}</td>
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

function CRMPanel({ session, onSignOut }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [filtroProducto, setFiltroProducto] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  const load = useCallback(async () => {
    setError('')
    let query = authClient.from('crm_contacts').select('*').order('creado_en', { ascending: false })
    if (filtroProducto !== 'todos') query = query.eq('producto_origen', filtroProducto)
    if (filtroEstado !== 'todos') query = query.eq('estado', filtroEstado)
    const { data, error: err } = await query
    if (err) { setError(err.message); setRows([]); return }
    setRows(data || [])
  }, [filtroProducto, filtroEstado])

  useEffect(() => { load() }, [load])

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

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select value={filtroProducto} onChange={(e) => setFiltroProducto(e.target.value)} style={{ fontSize: 12, padding: '6px 8px' }}>
          <option value="todos">Todos los productos</option>
          {PRODUCTOS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ fontSize: 12, padding: '6px 8px' }}>
          <option value="todos">Todos los estados</option>
          {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <div style={{ color: '#c00', fontSize: 13, marginBottom: 12 }}>Error: {error}</div>}

      {rows === null ? (
        <div style={{ fontSize: 13, color: '#888' }}>Cargando...</div>
      ) : rows.length === 0 ? (
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
            {rows.map((row) => <Row key={row.id} row={row} onSave={handleSaveRow} />)}
          </tbody>
        </table>
      )}
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
