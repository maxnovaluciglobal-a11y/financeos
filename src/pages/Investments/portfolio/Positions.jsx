// src/pages/Investments/portfolio/Positions.jsx — Portafolio › Posiciones (F1).
// Banda de resumen (riesgo al stop, valor, resultado y mayor peso), avisos de
// moneda y de capital, barra de acciones (Agregar, Exportar, moneda de las
// cifras) y una fila por posición que se despliega con su detalle, el stop
// editable y las acciones. Las filas suman el total (tipo de cambio de compra,
// utils/investPositions.js). Dirección siempre con flecha + signo + texto.
// Arriba de todo, "Pusiste / El mercado sumó" (esencial/PutSummary). En la
// vista esencial (utils/investView.js) no se muestran el riesgo al stop, el
// stop editable ni el capital de referencia: siguen en Vista completa.
import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Equal, Download, Plus, RefreshCw, Upload, FileJson, ListPlus, PlusCircle } from 'lucide-react'
import Money from '../../../components/Money.jsx'
import SheetSelect from '../../../components/ui/SheetSelect.jsx'
import { DISPLAY_CCY } from '../../../utils/investValuation.js'
import { allocation, concentrationAlternative } from '../../../utils/investPositions.js'
import { driftHint, rebalanceBase } from '../../../utils/investRebalance.js'
import { capitalLine, priceSources, riskShare } from './view.js'
import { parseInput, toneOf } from './format.js'
import { ChooserSheet } from './sheets.jsx'
import Sources from './Sources.jsx'
import PutSummary from '../esencial/PutSummary.jsx'
import { putAndGain } from '../../../utils/investEsencial.js'
import { shows } from '../../../utils/investView.js'
import s from './portfolio.module.css'

const TYPE_COLOR = { ETF: 'var(--cat-1)', Stock: 'var(--cat-2)', Crypto: 'var(--cat-3)', Otro: 'var(--cat-5)' }

export function Dir({ n, size = 14 }) {
  const Ic = n > 0 ? ArrowUp : n < 0 ? ArrowDown : Equal
  return <Ic size={size} strokeWidth={2.2} aria-hidden="true" />
}

function StopEditor({ row, onSave, t, fmt }) {
  const [v, setV] = useState(row.stop != null ? String(row.stop) : '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const id = `pf-stop-${row.id}`
  async function save(value) {
    const n = value === '' ? null : parseInput(value)
    if (n != null && !(n > 0)) { setErr(t('pf.err.stop_invalid')); return }
    setErr(''); setBusy(true)
    const r = await onSave(row, n)
    setBusy(false)
    if (!r.ok) setV(row.stop != null ? String(row.stop) : '')
  }
  return (
    <form className={s.inline} onSubmit={(e) => { e.preventDefault(); save(v) }} noValidate>
      <div className={s.field}>
        <label htmlFor={id} className={s.fieldLabel}>{t('pf.f.stop', { ccy: row.ccy || 'USD' })}</label>
        <input id={id} className={s.input} value={v} onChange={(e) => { setV(e.target.value); setErr('') }} inputMode="decimal" autoComplete="off"
          placeholder={t('pf.pos.noStop')} aria-invalid={err ? 'true' : undefined} aria-describedby={err ? `${id}-err` : `${id}-hint`} />
        {err ? <p id={`${id}-err`} className={s.error} role="alert">{err}</p>
          : <p id={`${id}-hint`} className={s.hint}>{t('pf.pos.stopRef', { price: fmt.native((row.price ?? row.avgCost) * 0.92, row.ccy) })}</p>}
      </div>
      <button type="submit" className={s.btn} disabled={busy}>{t('pf.save')}</button>
      {row.stop != null && <button type="button" className={s.btn} disabled={busy} onClick={() => { setV(''); save('') }}>{t('pf.pos.clearStop')}</button>}
    </form>
  )
}

function PositionRow({ r, open, onToggle, fmt, t, actions, stopColumn, limit, showStop = true }) {
  const panelId = `pf-row-${r.id}`
  const excluded = r.status === 'nofx'
  return (
    <li className={s.item}>
      <button type="button" className={s.rowHead} aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span className={s.badge} aria-hidden="true">{r.t.replace(/-USD$/, '').slice(0, 4)}</span>
        <span className={s.rowMain}>
          <span className={s.rowTitle}>{r.t}{r.name ? <span className={s.rowSub}> · {r.name}</span> : null}</span>
          <span className={s.rowSub}>
            {t(`pf.type.${r.type}`)} · {t('pf.pos.units', { n: fmt.units(r.sh) })}
            {r.weight != null && <> · {t('pf.pos.weight', { p: fmt.pct(r.weight, { decimals: 1 }) })}</>}
          </span>
          {r.overLimit && <span className={s.flag}>{t('pf.pos.overLimit', { limit })}</span>}
        </span>
        <span className={s.rowRight}>
          <span className={s.rowValue}><Money>{excluded ? t('pf.noFx') : fmt.money(r.valueUsd)}</Money></span>
          {excluded ? <span className={s.rowMeta}>{t('pf.pos.notCounted')}</span>
            : r.status === 'cost' ? <span className={s.rowMeta}>{t('pf.pos.atCost')}</span>
            : (
              <span className={`${s.rowMeta} ${s.tone}`} data-tone={toneOf(r.plUsd)}>
                <Dir n={r.plUsd} size={12} /><Money>{fmt.money(r.plUsd, { signed: true })}</Money> ({fmt.pct(r.plPct, { signed: true })})
              </span>
            )}
        </span>
      </button>
      {open && (
        <div id={panelId} className={s.panel}>
          <dl className={s.grid}>
            <dt>{t('pf.d.units')}</dt><dd>{fmt.units(r.sh)}</dd>
            <dt>{t('pf.d.entry')}</dt><dd><Money>{fmt.native(r.avgCost, r.ccy)}</Money></dd>
            <dt>{t('pf.d.price')}</dt><dd><Money>{r.price != null ? fmt.native(r.price, r.ccy) : t('pf.pos.noPrice')}</Money></dd>
            {r.changePct != null && <><dt>{t('pf.d.today')}</dt><dd className={s.tone} data-tone={toneOf(r.changePct)}><Dir n={r.changePct} size={12} /> {fmt.pct(r.changePct, { signed: true, decimals: 2 })}</dd></>}
            {!excluded && <>
              <dt>{t('pf.d.value', { ccy: fmt.dccy })}</dt><dd><Money>{fmt.money(r.valueUsd)}</Money></dd>
              <dt>{t('pf.d.cost', { ccy: fmt.dccy })}</dt><dd><Money>{fmt.money(r.costUsd)}</Money></dd>
              <dt>{t('pf.d.pl', { ccy: fmt.dccy })}</dt>
              <dd className={s.tone} data-tone={toneOf(r.plUsd)}><Dir n={r.plUsd} size={12} /> <Money>{fmt.money(r.plUsd, { signed: true })}</Money></dd>
              {r.fxEffectUsd ? <><dt>{t('pf.d.fxEffect')}</dt><dd><Money>{fmt.money(r.fxEffectUsd, { signed: true })}</Money></dd></> : null}
              <dt>{t('pf.d.weight')}</dt><dd>{fmt.pct(r.weight, { decimals: 1 })}</dd>
              {showStop && <>
                <dt>{t('pf.d.risk')}</dt>
                <dd>{r.riskUsd == null ? t('pf.pos.noStop') : <><Money>{fmt.money(-r.riskUsd)}</Money>{r.riskEstimated ? ` ${t('pf.pos.est')}` : ''}</>}</dd>
              </>}
            </>}
            {r.fxCost != null && <><dt>{t('pf.d.fxCost', { ccy: r.ccy })}</dt><dd>{fmt.units(r.fxCost)}</dd></>}
            {r.note && <><dt>{t('pf.f.note')}</dt><dd style={{ fontWeight: 400 }}>{r.note}</dd></>}
          </dl>
          {showStop && stopColumn && !excluded && <StopEditor row={r} onSave={actions.setStop} t={t} fmt={fmt} />}
          <div className={s.actionsRow}>
            <button type="button" className={s.btn} onClick={() => actions.openAsset(r.t)}>{t('pf.pos.openAsset')}</button>
            <button type="button" className={s.btn} onClick={() => actions.openTrade({ type: 'buy', ticker: r.t, price: r.price != null ? String(r.price) : '' })}>{t('pf.pos.trade')}</button>
            <button type="button" className={s.btn} onClick={() => actions.editPosition(r)}>{t('pf.pos.edit')}</button>
            <button type="button" className={`${s.btn} ${s.btnDanger}`} onClick={() => actions.deletePosition(r)}>{t('pf.pos.delete')}</button>
          </div>
        </div>
      )}
    </li>
  )
}

function CapitalLine({ pb, fmt, disp, t }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState('')
  const [err, setErr] = useState('')
  const line = capitalLine(pb.capital, pb.positions.totals.cost)
  async function save(e) {
    e.preventDefault()
    const n = parseInput(v)
    if (!(n > 0)) { setErr(t('pf.cap.invalid')); return }
    const r = await pb.setCapital(disp.rate === 1 ? n : n / disp.rate)
    if (!r.ok) { setErr(t(r.error === 'demo' ? 'pf.err.demo' : 'pf.err.save_failed')); return }
    setEditing(false); setErr('')
  }
  if (editing) {
    return (
      <form className={s.inline} onSubmit={save} noValidate>
        <div className={s.field}>
          <label htmlFor="pf-cap" className={s.fieldLabel}>{t('pf.cap.label', { ccy: fmt.dccy })}</label>
          <input id="pf-cap" className={s.input} value={v} onChange={(e) => { setV(e.target.value); setErr('') }} inputMode="decimal" autoComplete="off"
            aria-invalid={err ? 'true' : undefined} aria-describedby={err ? 'pf-cap-err' : undefined} />
          {err && <p id="pf-cap-err" className={s.error} role="alert">{err}</p>}
        </div>
        <button type="submit" className={`${s.btn} ${s.btnPrimary}`}>{t('pf.save')}</button>
        <button type="button" className={s.btn} onClick={() => { setEditing(false); setErr('') }}>{t('pf.cancel')}</button>
      </form>
    )
  }
  const startEdit = () => { setV(line ? String(Math.round((line.capital * disp.rate) * 100) / 100) : ''); setEditing(true) }
  return (
    <p className={s.note}>
      {line
        ? <>{t('pf.cap.ref')} <Money>{fmt.money(line.capital)}</Money> · {t('pf.cap.free')} <Money>{fmt.money(line.free)}</Money>{line.over ? ` ${t('pf.cap.over')}` : ''} </>
        : <>{t('pf.cap.none')} </>}
      <button type="button" className={s.link} onClick={startEdit}>{line ? t('pf.cap.change') : t('pf.cap.define')}</button>
    </p>
  )
}

export default function Positions({ pb, fmt, disp, demo, t, actions, targets, settings = {}, view = 'esencial' }) {
  const [openId, setOpenId] = useState(null)
  const [menu, setMenu] = useState(null) // 'add' | 'export'
  const { rows, totals } = pb.positions
  const showStop = shows(view, 'stop')
  const put = useMemo(() => putAndGain({ ledger: pb.opsState === 'ready' ? pb.ledger : null, totals: { ...totals, total: totals.pl } }), [pb.opsState, pb.ledger, totals])
  const share = riskShare(totals.risk, pb.capital, totals.value)
  const base = useMemo(() => rebalanceBase(rows), [rows])
  const drift = targets ? driftHint(base, targets) : null
  const alloc = allocation(rows)
  const src = priceSources(rows, pb.market.quotes, { demo })
  const foreign = rows.some(r => r.ccy && r.ccy !== 'USD')
  const top = totals.top
  const topRow = top ? rows.find(r => r.t === top.t) : null
  const alt = topRow && top.weight * 100 > totals.limit ? concentrationAlternative(topRow.priceUsd, rows.filter(r => r.t === top.t).reduce((a, r) => a + r.sh, 0), totals.value, totals.limit) : null
  const busy = pb.phase === 'loading' || pb.market.phase === 'loading' || pb.market.phase === 'refreshing' || pb.phase === 'refreshing'

  if (pb.phase === 'loading') return <p className={s.note} role="status">{t('pf.loading')}</p>
  if (pb.phase === 'error') {
    return (
      <div className={s.notice} role="alert">
        {t(pb.error === 'session_required' ? 'pf.err.session_required' : 'pf.loadError')}
        <div className={s.noticeActions}><button type="button" className={s.btn} onClick={pb.reload}><RefreshCw size={16} aria-hidden="true" />{t('pf.retry')}</button></div>
      </div>
    )
  }

  const addMenu = [
    { id: 'pos', icon: <Plus size={20} aria-hidden="true" />, label: t('pf.add.position'), sub: t('pf.add.positionSub'), onPick: () => actions.addPosition() },
    { id: 'op', icon: <ListPlus size={20} aria-hidden="true" />, label: t('pf.add.trade'), sub: t('pf.add.tradeSub'), onPick: () => actions.openTrade({ type: 'buy' }) },
    { id: 'csv', icon: <Upload size={20} aria-hidden="true" />, label: t('pf.add.csv'), sub: t('pf.add.csvSub'), onPick: actions.importCsv },
    { id: 'json', icon: <FileJson size={20} aria-hidden="true" />, label: t('pf.add.json'), sub: t('pf.add.jsonSub'), onPick: actions.restore },
  ]
  addMenu.cancelLabel = t('pf.close')
  const exportMenu = [
    { id: 'pos', icon: <Download size={20} aria-hidden="true" />, label: t('pf.exp.positions'), sub: t('pf.exp.positionsSub'), onPick: actions.exportPositions, disabled: !rows.length },
    { id: 'ops', icon: <Download size={20} aria-hidden="true" />, label: t('pf.exp.ops'), sub: t('pf.exp.opsSub'), onPick: actions.exportOperations, disabled: !pb.ops.length },
    { id: 'json', icon: <FileJson size={20} aria-hidden="true" />, label: t('pf.exp.json'), sub: t('pf.exp.jsonSub'), onPick: actions.exportBackup },
  ]
  exportMenu.cancelLabel = t('pf.close')

  const toolbar = (
    <div className={s.toolbar}>
      <button type="button" className={`${s.btn} ${s.btnPrimary}`} aria-haspopup="dialog" onClick={() => setMenu('add')}><PlusCircle size={18} aria-hidden="true" />{t('pf.add')}</button>
      <button type="button" className={s.btn} aria-haspopup="dialog" onClick={() => setMenu('export')}><Download size={18} aria-hidden="true" />{t('pf.export')}</button>
      <span className={s.toolbarGrow} />
      <div className={s.field} style={{ minWidth: 110 }}>
        <label htmlFor="pf-disp" className={s.fieldLabel}>{t('pf.dispCcy')}</label>
        <SheetSelect id="pf-disp" className={s.select} value={actions.dispCcy} onChange={(e) => actions.setDispCcy(e.target.value)}>
          {DISPLAY_CCY.map(c => <option key={c} value={c}>{c}</option>)}
        </SheetSelect>
      </div>
      {!demo && (
        <button type="button" className={s.iconBtn} onClick={pb.reload} disabled={busy} aria-label={t('pf.refresh')}>
          <RefreshCw size={18} aria-hidden="true" className={busy ? s.spin : undefined} />
        </button>
      )}
    </div>
  )
  const menus = (
    <>
      <ChooserSheet open={menu === 'add'} onClose={() => setMenu(null)} title={t('pf.add.title')} options={addMenu} />
      <ChooserSheet open={menu === 'export'} onClose={() => setMenu(null)} title={t('pf.exp.title')} options={exportMenu} />
    </>
  )

  if (!rows.length) {
    return (
      <>
        <section className={s.empty} aria-labelledby="pf-empty-title">
          <h2 id="pf-empty-title" className={s.emptyTitle}>{t('pf.empty.title')}</h2>
          <p className={s.note}>{t('pf.empty.body')}</p>
          <div className={s.choices}>
            <button type="button" className={s.choiceBtn} onClick={() => actions.addPosition()}><Plus size={20} aria-hidden="true" /><span>{t('pf.empty.add')}<small>{t('pf.empty.addSub')}</small></span></button>
            <button type="button" className={s.choiceBtn} onClick={actions.importCsv}><Upload size={20} aria-hidden="true" /><span>{t('pf.empty.csv')}<small>{t('pf.empty.csvSub')}</small></span></button>
            <button type="button" className={s.choiceBtn} onClick={() => actions.openTrade({ type: 'buy' })}><ListPlus size={20} aria-hidden="true" /><span>{t('pf.add.trade')}<small>{t('pf.add.tradeSub')}</small></span></button>
          </div>
        </section>
        {pb.ops.length > 0 && <p className={s.note}>{t('pf.empty.opsLeft', { n: pb.ops.length })}</p>}
        {menus}
        <Sources t={t} src={src} fx={false} />
      </>
    )
  }

  const n = rows.length
  return (
    <>
      <PutSummary summary={put} money={(v, signed) => fmt.money(v, { signed })} pct={(f, signed) => fmt.pct(f, { signed })} currency={settings.currency} />
      <p className={s.note}>{t(n === 1 ? 'pf.pos.count.one' : 'pf.pos.count.many', { n })} · {t(demo ? 'pf.pos.notSaved' : 'pf.pos.saved')}</p>

      <section className={s.band} aria-label={t('pf.band.label')}>
        {showStop && <div className={`${s.stat} ${s.bandWide}`}>
          <span className={s.statLabel}>{t('pf.band.risk')}</span>
          <span className={`${s.statValue} ${s.statBig}`}><Money>{fmt.money(totals.risk > 0 ? -totals.risk : 0)}</Money></span>
          <span className={s.statSub}>
            {share ? t(share.onCapital ? 'pf.band.riskOfCapital' : 'pf.band.riskOfValue', { p: fmt.pct(share.pct, { decimals: 1 }) }) : ''}
            {totals.estimated ? ` · ${t('pf.band.riskEstimated')}` : totals.noStop > 0 ? ` · ${t(totals.noStop === 1 ? 'pf.band.noStop.one' : 'pf.band.noStop.many', { n: totals.noStop })}` : ''}
          </span>
        </div>}
        <div className={s.stat}>
          <span className={s.statLabel}>{t('pf.band.value')}</span>
          <span className={s.statValue}><Money>{fmt.money(totals.value)}</Money></span>
          {fmt.dccy !== 'USD' && <span className={s.statSub}>≈ <Money>{fmt.inCcy(totals.value, 'USD')}</Money></span>}
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>{t('pf.band.pl')}</span>
          <span className={`${s.statValue} ${s.tone}`} data-tone={toneOf(totals.pl)}><Dir n={totals.pl} /> <Money>{fmt.money(totals.pl, { signed: true })}</Money></span>
          <span className={s.statSub}>{t('pf.band.plSub', { p: fmt.pct(totals.plPct, { signed: true }) })}</span>
        </div>
        {totals.dayPct != null && (
          <div className={s.stat}>
            <span className={s.statLabel}>{t('pf.band.day')}</span>
            <span className={`${s.statValue} ${s.tone}`} data-tone={toneOf(totals.day)}><Dir n={totals.day} /> <Money>{fmt.money(totals.day, { signed: true })}</Money></span>
            <span className={s.statSub}>{fmt.pct(totals.dayPct, { signed: true, decimals: 2 })}</span>
          </div>
        )}
        {top && (
          <div className={s.stat}>
            <span className={s.statLabel}>{t('pf.band.top')}</span>
            <span className={s.statValue}>{top.t} · {fmt.pct(top.weight, { decimals: 1 })}</span>
            <span className={s.statSub}>
              {top.weight * 100 > totals.limit
                ? <><span className={s.tag}>{t('pf.band.overLimit', { limit: totals.limit })}</span>{alt ? ` ${t('pf.band.alt', { units: fmt.units(alt.units), p: fmt.pct(alt.weight, { decimals: 1 }) })}` : ''}</>
                : t('pf.band.limit', { limit: totals.limit })}
            </span>
          </div>
        )}
      </section>

      <div className={s.notes}>
        {totals.excluded > 0 && <p className={s.note}>{t(totals.excluded === 1 ? 'pf.note.noFx.one' : 'pf.note.noFx.many', { n: totals.excluded, ccy: totals.excludedCcys.join(', ') })}</p>}
        {Math.abs(totals.fxEffect) >= 0.5 && <p className={s.note}>{t('pf.note.fxEffect', { amount: fmt.money(totals.fxEffect, { signed: true }) })}</p>}
        {totals.fxUnknown > 0 && <p className={s.note}>{t(totals.fxUnknown === 1 ? 'pf.note.fxUnknown.one' : 'pf.note.fxUnknown.many', { n: totals.fxUnknown })}</p>}
        {totals.unpriced > 0 && <p className={s.note}>{t(totals.unpriced === 1 ? 'pf.note.unpriced.one' : 'pf.note.unpriced.many', { n: totals.unpriced })}</p>}
        {pb.market.phase === 'error' && <p className={s.note} role="status">{t('pf.note.marketError')}</p>}
        {showStop && <CapitalLine pb={pb} fmt={fmt} disp={disp} t={t} />}
        {fmt.dccy !== 'USD' && (
          <p className={s.note}>
            {disp.missing ? t('pf.note.dispMissing', { ccy: actions.dispCcy }) : t('pf.note.disp', { ccy: fmt.dccy, rate: fmt.units(Math.round(disp.rate * 100) / 100) })}
            {disp.fallback ? ` ${t('pf.note.dispFallback')}` : ''}
          </p>
        )}
        {pb.rates.ars && (fmt.dccy === 'ARS' || rows.some(r => r.ccy === 'ARS')) && (
          <div className={s.inline}>
            <p className={s.note} style={{ flex: '1 1 200px' }}>
              {t(pb.rates.ars.kind === 'MEP' ? 'pf.ars.mep' : 'pf.ars.oficial')}{pb.rates.ars.fallback ? ` ${t('pf.ars.fallback')}` : ''}
            </p>
            <div className={s.field} style={{ minWidth: 140 }}>
              <label htmlFor="pf-ars" className={s.fieldLabel}>{t('pf.ars.label')}</label>
              <SheetSelect id="pf-ars" className={s.select} value={pb.arsKind} onChange={(e) => pb.setArsKind(e.target.value)}>
                <option value="MEP">{t('pf.ars.optMep')}</option>
                <option value="Oficial">{t('pf.ars.optOficial')}</option>
              </SheetSelect>
            </div>
          </div>
        )}
        {foreign && <p className={s.note}>{t('pf.note.foreign', { ccy: fmt.dccy })}</p>}
        {drift && (
          <div className={s.notice} data-tone="warn">
            <span>{t(drift.count === 1 ? 'pf.drift.one' : 'pf.drift.many', { n: drift.count, t: drift.top.t, pts: fmt.pts(drift.top.pts) })}</span>
            <div className={s.noticeActions}><button type="button" className={s.btn} onClick={actions.goTargets}>{t('pf.drift.cta')}</button></div>
          </div>
        )}
      </div>

      {toolbar}

      <section className={s.section} aria-labelledby="pf-pos-title">
        <div className={s.sectionHead}>
          <h2 id="pf-pos-title" className={s.sectionTitle}>{t('pf.pos.title')}</h2>
          <span className={s.sectionHint}>{t('pf.pos.tapHint')}</span>
        </div>
        <ul className={s.list}>
          {rows.map((r, i) => (
            // INV-N15: dos lotes del mismo ticker; la key es el id.
            <PositionRow key={r.id ?? `${r.t}-${i}`} r={r} open={openId === (r.id ?? `${r.t}-${i}`)} onToggle={() => setOpenId(id => (id === (r.id ?? `${r.t}-${i}`) ? null : (r.id ?? `${r.t}-${i}`)))}
              fmt={fmt} t={t} actions={actions} stopColumn={pb.columns.stop} limit={totals.limit} showStop={showStop} />
          ))}
        </ul>
        <div className={s.totalRow}>
          <strong>{t('pf.total')}</strong>
          <strong><Money>{fmt.money(totals.value)}</Money></strong>
          <span>{t('pf.band.pl')}</span>
          <span className={s.tone} data-tone={toneOf(totals.pl)}><Dir n={totals.pl} size={12} /> <Money>{fmt.money(totals.pl, { signed: true })}</Money> ({fmt.pct(totals.plPct, { signed: true })})</span>
          {showStop && <>
            <span>{t('pf.band.risk')}</span>
            <span><Money>{totals.risk > 0 ? fmt.money(-totals.risk) : fmt.money(0)}</Money></span>
          </>}
        </div>
        <p className={s.note}>{t('pf.pos.sumNote')}</p>
      </section>

      {alloc.length > 0 && (
        <section className={s.section} aria-labelledby="pf-alloc-title">
          <h2 id="pf-alloc-title" className={s.sectionTitle}>{t('pf.alloc.title')}</h2>
          <div className={s.allocBar} aria-hidden="true">
            {alloc.map(a => <span key={a.type} className={s.allocSeg} style={{ flexGrow: a.share, background: TYPE_COLOR[a.type] || TYPE_COLOR.Otro }} />)}
          </div>
          <ul className={s.legend}>
            {alloc.map(a => (
              <li key={a.type} className={s.legendItem}>
                <span className={s.dot} style={{ background: TYPE_COLOR[a.type] || TYPE_COLOR.Otro }} aria-hidden="true" />
                {t(`pf.alloc.${a.type}`)}
                <span className={s.legendPct}>{fmt.pct(a.share, { decimals: 0 })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={s.notes}>
        {showStop && <p className={s.note}>{t(totals.estimated ? 'pf.pos.footEstimated' : 'pf.pos.foot')}</p>}
        <Sources t={t} src={src} fx={foreign || fmt.dccy !== 'USD'} ars={!!pb.rates.ars} />
      </div>
      {menus}
    </>
  )
}
