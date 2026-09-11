// src/pages/Steuer/index.jsx
// Módulo Alemania — herramienta fiscal exclusiva (mismo patrón que APV Chile).
// Solo visible si settings.country === 'DE'. Dos calculadoras:
// 1) Lohnabzüge: bruto → neto (Sozialversicherung + Lohnsteuer + Soli + Kirchensteuer)
// 2) Werbungskosten: gastos deducibles vs Pauschbetrag automático
//
// Todo el texto pasa por i18n. Las etiquetas de config (deducciones/de.js) también
// se resuelven vía t() usando claves 'steuer.werbungskosten.cat.<key>'.

import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Card, CardHeader, FormRow, FormGroup, ProgressBar, Alert, PageHeader, Btn } from '../../components/ui/index.jsx'
import ProGate from '../../components/ui/ProGate.jsx'
import { calcDescuentosDE, calcZvE, BUNDESLAENDER, ARBEITNEHMER_PAUSCHBETRAG } from '../../utils/taxCalcDE.js'
import { tasaMarginalDE } from '../../config/deducciones/de.js'
import { getDeduccionesConfig, autofillGastos } from '../../utils/deduccionesEngine.js'

const fmtEUR = (n) => `€${(Number(n) || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`

// Mapeo categoría interna → sección de la Anlage N (declaración Elster).
// Los NOMBRES de sección son estables; los números de Zeile cambian de año
// a año y de formulario a formulario — por eso no se citan aquí. Es lo que
// un alemán normalmente paga a WISO/Taxfix (€30-70/año) por generar: un
// resumen ya categorizado, listo para ubicar en Elster por nombre.
const ELSTER_SECCIONES = {
  pendler: 'Wege zwischen Wohnung und erster Tätigkeitsstätte (Entfernungspauschale)',
  homeoffice: 'Homeoffice-Pauschale',
  fortbildung: 'Aufwendungen für Fortbildung',
  arbeitsmittel: 'Arbeitsmittel',
  bewerbung: 'Bewerbungskosten',
}

export default function Steuer() {
  const { settings, expenses } = useApp()
  const { t } = useT()
  const country = (settings.country || 'CL').toUpperCase()

  if (country !== 'DE') {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--th)', fontFamily: 'var(--mono)', fontSize: 13 }}>
        {t('steuer.onlyDE')}
      </div>
    )
  }

  return (
    <ProGate feature={t('steuer.proFeature')}>
      <div className="stack">
        <PageHeader title={t('steuer.title')} sub={t('steuer.sub')} />
        <Alert type="info">⚠ {t('steuer.disclaimer')}</Alert>
        <LohnabzuegeCard />
        <WerbungskostenCard expenses={expenses} settings={settings} />
      </div>
    </ProGate>
  )
}

function LohnabzuegeCard() {
  const { t } = useT()
  const [brutto, setBrutto] = useState('')
  const [kirche, setKirche] = useState(false)
  const [bundesland, setBundesland] = useState('NW')
  // Kinderlosenzuschlag de la Pflegeversicherung (+0.6% íntegro del empleado):
  // se aplica salvo que se marque "tengo hijos", igual que los Brutto-Netto-Rechner alemanes.
  const [hatKinder, setHatKinder] = useState(false)

  const result = useMemo(() => {
    const b = Number(brutto) || 0
    if (b <= 0) return null
    return calcDescuentosDE(b, { kirchensteuerpflichtig: kirche, bundesland, hatKinder })
  }, [brutto, kirche, bundesland, hatKinder])

  return (
    <Card>
      <CardHeader title={t('steuer.lohn.title')} />
      <FormRow>
        <FormGroup label={t('steuer.lohn.brutto')}>
          <input type="number" inputMode="decimal" min="0" value={brutto} placeholder="0"
            onChange={e => setBrutto(e.target.value)} />
        </FormGroup>
        <FormGroup label={t('steuer.lohn.bundesland')}>
          <select value={bundesland} onChange={e => setBundesland(e.target.value)}>
            {BUNDESLAENDER.map(bl => <option key={bl.code} value={bl.code}>{bl.label}</option>)}
          </select>
        </FormGroup>
      </FormRow>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--tx)', margin: '4px 0 12px', cursor: 'pointer' }}>
        <input type="checkbox" checked={kirche} onChange={e => setKirche(e.target.checked)} style={{ width: 16, height: 16, flexShrink: 0 }} />
        {t('steuer.lohn.kircheLabel')}
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--tx)', margin: '-8px 0 12px', cursor: 'pointer' }}>
        <input type="checkbox" checked={hatKinder} onChange={e => setHatKinder(e.target.checked)} style={{ width: 16, height: 16, flexShrink: 0 }} />
        {t('steuer.lohn.kinderLabel')}
      </label>

      {result && (
        <>
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 34, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
              {fmtEUR(result.netto)}
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', marginTop: 6 }}>
              {t('steuer.lohn.nettoSub', { pct: Math.round(result.tasaEfectiva * 100) })}
            </div>
          </div>

          <div style={{ marginTop: 4, borderTop: '.5px solid var(--brd)', paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
              {t('steuer.lohn.sozialTitle')}
            </div>
            {[
              [t('steuer.lohn.rente'), result.sozialversicherung.rentenversicherung],
              [t('steuer.lohn.kv'), result.sozialversicherung.krankenversicherung],
              [t('steuer.lohn.alv'), result.sozialversicherung.arbeitslosenversicherung],
              [t('steuer.lohn.pv'), result.sozialversicherung.pflegeversicherung],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: 'var(--tx)' }}>
                <span>{label}</span>
                <span style={{ fontFamily: 'var(--mono)' }}>{fmtEUR(val)}</span>
              </div>
            ))}

            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '12px 0 8px' }}>
              {t('steuer.lohn.taxesTitle')}
            </div>
            {[
              [t('steuer.lohn.lohnsteuer'), result.lohnsteuer],
              [t('steuer.lohn.soli'), result.soli],
              ...(result.kirchensteuer > 0 ? [[t('steuer.lohn.kirche'), result.kirchensteuer]] : []),
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: 'var(--tx)' }}>
                <span>{label}</span>
                <span style={{ fontFamily: 'var(--mono)' }}>{fmtEUR(val)}</span>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, padding: '8px 0 0', marginTop: 8, borderTop: '.5px solid var(--brd)', color: 'var(--tx)' }}>
              <span>{t('steuer.lohn.totalAbzuege')}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{fmtEUR(result.totalAbzuege)}</span>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}

function WerbungskostenCard({ expenses, settings }) {
  const { t } = useT()
  const config = getDeduccionesConfig('DE')
  const activeMonth = settings.activeMonth || new Date().toISOString().slice(0, 7)
  const year = activeMonth.slice(0, 4)

  // Autofill gastos desde registros del año actual
  const autofilled = useMemo(() => autofillGastos(config, expenses, year), [config, expenses, year])
  const [gastos, setGastos] = useState(autofilled)
  const [ingreso, setIngreso] = useState('')

  function setGasto(key, val) {
    setGastos(p => ({ ...p, [key]: val === '' ? 0 : Number(val) }))
  }

  // Recalculamos aquí en vez de en el config para poder usar i18n en textos.
  const result = useMemo(() => {
    const homeofficeCap = Math.min(Number(gastos.homeoffice) || 0, 1260)
    const totalGastos =
      (Number(gastos.pendler) || 0) +
      homeofficeCap +
      (Number(gastos.fortbildung) || 0) +
      (Number(gastos.arbeitsmittel) || 0) +
      (Number(gastos.bewerbung) || 0)
    const PAUSCH = ARBEITNEHMER_PAUSCHBETRAG
    const superaPauschale = totalGastos > PAUSCH
    const excedente = Math.max(0, totalGastos - PAUSCH)
    const ing = Number(ingreso) || 0
    // La tasa marginal se evalúa sobre el zvE (bruto − Werbungskosten −
    // Sonderausgaben-Pauschbetrag − Vorsorgepauschale), no sobre el bruto.
    // Única fuente de la escala: tasaMarginalDE en config/deducciones/de.js.
    const zvE = calcZvE(ing, { werbungskostenAnual: Math.max(totalGastos, PAUSCH) })
    const tasa = tasaMarginalDE(zvE)
    return {
      ahorro: Math.round(excedente * tasa),
      pausch: PAUSCH,
      totalGastos: Math.round(totalGastos),
      // No es un tope: pasar de 100% es justamente el objetivo.
      topePct: totalGastos > 0 ? (totalGastos / PAUSCH) * 100 : 0,
      superaPauschale,
      tasa,
      desglose: [
        { key: 'pendler', monto: Math.round(Number(gastos.pendler) || 0) },
        { key: 'homeoffice', monto: Math.round(homeofficeCap) },
        { key: 'fortbildung', monto: Math.round(Number(gastos.fortbildung) || 0) },
        { key: 'arbeitsmittel', monto: Math.round(Number(gastos.arbeitsmittel) || 0) },
        { key: 'bewerbung', monto: Math.round(Number(gastos.bewerbung) || 0) },
      ],
    }
  }, [gastos, ingreso])

  return (
    <Card>
      <CardHeader title={t('steuer.werb.title')} right={<span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)' }}>{year}</span>} />
      <div style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.6, marginBottom: 14 }}>{t('steuer.werb.sub')}</div>

      <FormRow>
        <FormGroup label={t('steuer.werb.ingresoLabel')}>
          <input type="number" inputMode="decimal" min="0" value={ingreso} placeholder="0"
            onChange={e => setIngreso(e.target.value)} />
        </FormGroup>
      </FormRow>

      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '12px 0 8px' }}>
        {t('steuer.werb.gastosLabel')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {config.categorias.map(c => (
          <FormGroup key={c.key} label={t('steuer.werb.cat.' + c.key)}>
            <input type="number" inputMode="decimal" min="0" value={gastos[c.key] ?? 0}
              onChange={e => setGasto(c.key, e.target.value)} />
          </FormGroup>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 34, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
            {fmtEUR(result.ahorro)}
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', marginTop: 6 }}>
            {result.superaPauschale
              ? t('steuer.werb.resumenSupera', { gastos: result.totalGastos.toLocaleString('de-DE'), pausch: result.pausch.toLocaleString('de-DE'), pct: Math.round(result.tasa * 100) })
              : t('steuer.werb.resumenBaja', { pausch: result.pausch.toLocaleString('de-DE') })}
          </div>
        </div>

        <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)' }}>
          <span>{t('steuer.werb.aprovechamiento')}</span>
          <span>{Math.round(result.topePct)}%</span>
        </div>
        {/* El Pauschbetrag es un SUELO, no un techo: la barra se llena al 100%
            cuando los gastos igualan el mínimo automático, y superarlo es lo bueno. */}
        <ProgressBar value={Math.min(100, result.topePct)} max={100} color={result.topePct >= 100 ? 'green' : 'amber'} height={6} />
        <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 6, lineHeight: 1.5 }}>
          {t('steuer.werb.aprovechamientoHint')}
        </div>

        <div style={{ marginTop: 16, borderTop: '.5px solid var(--brd)', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>{t('steuer.werb.desglose')}</div>
          {result.desglose.map(d => (
            <div key={d.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: 'var(--tx)' }}>
              <span>{t('steuer.werb.cat.' + d.key)}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{fmtEUR(d.monto)}</span>
            </div>
          ))}
        </div>

        <ElsterExport desglose={result.desglose} year={year} t={t} />
      </div>
    </Card>
  )
}

// Genera un resumen de texto listo para transcribir a Elster — el "producto"
// que WISO/Taxfix cobran €30-70/año por entregar. Solo formatea lo que el
// desglose ya calculó, sin lógica fiscal nueva. Nombres de sección estables;
// los números de Zeile de Elster cambian por año/versión de formulario, así
// que no se citan (buscar por nombre dentro de Elster es más fiable).
function ElsterExport({ desglose, year, t }) {
  const [abierto, setAbierto] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const lineas = desglose.filter(d => d.monto > 0)
  const total = lineas.reduce((s, d) => s + d.monto, 0)

  const texto = [
    `Werbungskosten ${year} — resumen para Elster (Anlage N)`,
    '',
    ...lineas.map(d => `${ELSTER_SECCIONES[d.key]}: ${fmtEUR(d.monto)}`),
    '',
    `Total Werbungskosten: ${fmtEUR(total)}`,
    '',
    'Generado con MOY IQ — verificar cifras antes de declarar.',
  ].join('\n')

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {}
  }

  function descargar() {
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `werbungskosten-${year}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (lineas.length === 0) return null

  return (
    <div style={{ marginTop: 16, borderTop: '.5px solid var(--brd)', paddingTop: 12 }}>
      <Btn variant="ghost" size="sm" onClick={() => setAbierto(o => !o)}>
        {abierto ? '▾' : '▸'} Exportar resumen para Elster
      </Btn>
      {abierto && (
        <div style={{ marginTop: 10 }}>
          <pre style={{
            fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--tx)', background: 'var(--sur2)',
            border: '.5px solid var(--brd)', borderRadius: 'var(--r)', padding: '12px 14px',
            whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 8,
          }}>{texto}</pre>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" size="sm" onClick={copiar}>{copiado ? '✓ Copiado' : 'Copiar'}</Btn>
            <Btn variant="ghost" size="sm" onClick={descargar}>Descargar .txt</Btn>
          </div>
        </div>
      )}
    </div>
  )
}
