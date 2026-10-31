// src/pages/Settings/CurrencyScreen.jsx — Ajustes › Moneda e idioma (R10).
// Moneda e idioma ya no son selects nativos: abren una hoja de selección
// (OptionSheetRow). Cambiar la moneda sigue pidiendo confirmación. El bloque de
// moneda secundaria y tasa se movió tal cual desde la pantalla única.
import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { Btn } from '../../components/ui/index.jsx'
import { CURRENCY_OPTIONS, currencyOptionLabel } from '../shared/constants.js'
import { useT } from '../../i18n/useT.js'
import { moneyLocale } from '../../utils/index.js'
import { loadFixerRates } from '../../utils/tasaFixer.js'
import { savedRate } from '../../utils/refRate.js'
import { rateSourceText, fmtDay } from '../Dashboard/RefCurrency.jsx'
import { srow, slbl, ssub, Switch, Setting, OptionSheetRow } from './settingsUi.jsx'

// Nombres de idioma en su propio idioma (no se traducen).
export const LANGUAGE_OPTIONS = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
  { value: 'de', label: 'Deutsch' },
]

export default function CurrencyScreen() {
  const { settings, updateSettings } = useApp()
  const { t, lang } = useT()
  const [fx, setFx] = useState(null) // { rates, source: 'fixer'|'fallback' } — null mientras carga
  const [confirm, setConfirm] = useState(null) // { nextCurrency, nextRate } | null

  useEffect(() => { loadFixerRates().then(setFx) }, [])
  // Tasa a usar: la de Fixer si ya cargó, si no el hardcodeado de siempre —
  // nunca deja al usuario esperando un fetch para ver/editar el campo.
  // FIN-17: solo una tasa consultada de verdad (Fixer). El respaldo fijo
  // DEFAULT_USD_RATES (VES 36 frente a ~880 reales) ya no se guarda como
  // usdRate: sin tasa, el campo queda vacío y el Inicio pide agregarla.
  const liveRate = (currency) => (fx?.source === 'fixer' ? fx?.rates?.[currency] : undefined)
  // R12: la tasa guarda su fecha y fuente (el Inicio nunca muestra una tasa sin
  // fecha). Solo una tasa consultada de verdad (Fixer) lleva fecha de consulta;
  // el valor fijo de respaldo queda "sin fecha" para que el Inicio lo diga.
  const rateMeta = (currency, rate) => {
    if (!(rate > 0)) return { usdRateAt: null, usdRateSource: null }
    const live = fx?.source === 'fixer' && Number(fx?.rates?.[currency]) === Number(rate)
    return live ? { usdRateAt: fx.ts, usdRateSource: 'fixer' } : { usdRateAt: null, usdRateSource: null }
  }

  function askChangeCurrency(nextCurrency) {
    if (nextCurrency === settings.currency) return
    // La tasa vieja no sirve para la moneda nueva (bug ya arreglado una vez:
    // "usdRate carried over numerically across currency changes"). Pero
    // resetear a 0 sin más apaga la moneda dual en el Dashboard en silencio
    // (dualOn exige usdRate > 0) — recomputamos ya mismo si el toggle está
    // activo, en vez de dejar un 0 a la espera de que el usuario vuelva acá.
    const nextRate = settings.showDualCurrency ? (liveRate(nextCurrency) || 0) : 0
    setConfirm({ nextCurrency, nextRate })
  }

  function handleConfirmChangeCurrency() {
    if (!confirm) return
    const { nextCurrency, nextRate } = confirm
    setConfirm(null)
    updateSettings({ ...settings, currency: nextCurrency, usdRate: nextRate, ...rateMeta(nextCurrency, nextRate) })
  }

  return (
    <div>
      <Setting id="currency">
        <OptionSheetRow
          label={t('settings.currency.label')}
          sub={t('settings.currency.sub')}
          value={settings.currency || 'CLP'}
          options={CURRENCY_OPTIONS.map(c => ({ value: c.code, label: currencyOptionLabel(c.code, lang) }))}
          onChange={askChangeCurrency}
        />
        {confirm && (
          <div role="group" aria-label={t('settings.currency.label')} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',margin:'8px 0',background:'rgba(184,134,59,0.08)',borderRadius:8,border: 0,flexWrap:'wrap'}}>
            <span style={{fontSize:12,color:'var(--tx)',fontFamily: 'var(--sans)',flex:1}}>
              {t('settings.confirmChangeCurrency', { currency: confirm.nextCurrency })}
            </span>
            <div style={{display:'flex',gap:6}}>
              <Btn variant="primary" size="xs" onClick={handleConfirmChangeCurrency}>{t('debts.card.confirm')}</Btn>
              <Btn variant="ghost"   size="xs" onClick={()=>setConfirm(null)}>{t('common.cancel')}</Btn>
            </div>
          </div>
        )}
      </Setting>

      <Setting id="language">
        <OptionSheetRow
          label={t('settings.language.label')}
          sub={t('settings.language.sub')}
          value={settings.language || 'es'}
          options={LANGUAGE_OPTIONS}
          onChange={(v) => updateSettings({ ...settings, language: v, languageExplicit: true })}
        />
      </Setting>

      {/* Moneda secundaria */}
      <Setting id="dual">
        <div style={{ ...srow, borderBottom: settings.showDualCurrency ? srow.borderBottom : 'none' }}>
          <div>
            <div style={slbl} id="settings-dual-label">{t('settings.dualCurrency.label')}</div>
            <div style={ssub}>{t('settings.dualCurrency.sub')}</div>
          </div>
          <Switch
            checked={!!settings.showDualCurrency}
            labelledBy="settings-dual-label"
            onChange={() => {
              const next = !settings.showDualCurrency
              const rate = settings.usdRate || liveRate(settings.currency || 'CLP') || 0
              const meta = settings.usdRate ? {} : rateMeta(settings.currency || 'CLP', rate)
              updateSettings({ ...settings, showDualCurrency: next, usdRate: rate, ...meta })
            }}
          />
        </div>

        {settings.showDualCurrency && settings.currency !== 'USD' && (
          <div style={{...srow, borderBottom:'none', flexDirection:'column', alignItems:'flex-start', gap:10}}>
            <div>
              <div style={slbl}>{t('settings.exchangeRate.label', { currency: settings.currency || 'CLP' })}</div>
              <div style={ssub}>{t('settings.exchangeRate.sub')}</div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:8, width:'100%', flexWrap:'wrap'}}>
              <input
                type="number" inputMode="decimal" min="0" step="any"
                aria-label={t('settings.exchangeRate.label', { currency: settings.currency || 'CLP' })}
                value={settings.usdRate || liveRate(settings.currency) || ''}
                placeholder={String(liveRate(settings.currency) || '')}
                onChange={e => { const v = parseFloat(e.target.value) || 0; updateSettings({...settings, usdRate: v, usdRateAt: v > 0 ? Date.now() : null, usdRateSource: v > 0 ? 'manual' : null}) }}
                style={{flex:'1 1 120px', padding:'7px 10px', minHeight:44, borderRadius:8, border:'.5px solid var(--brd2)',
                  background:'var(--sur2)', color:'var(--tx)', fontSize:13, fontFamily: 'var(--sans)', boxSizing:'border-box'}}
              />
              <span style={{fontSize:12, color:'var(--th)', fontFamily: 'var(--sans)', whiteSpace:'nowrap'}}>
                {t('settings.exchangeRate.perUsd', { currency: settings.currency || 'CLP' })}
              </span>
              <Btn variant="ghost" size="sm"
                onClick={() => { const r = liveRate(settings.currency) || 0; updateSettings({...settings, usdRate: r, ...rateMeta(settings.currency, r)}) }}>
                {t('settings.exchangeRate.reset')}
              </Btn>
            </div>
            {/* B1: la misma descripción de la tasa que el Inicio (fuente · fecha o "sin fecha"). */}
            {savedRate(settings) && (
              <div style={{fontSize:11, color:'var(--tm)', fontFamily: 'var(--sans)'}}>
                ● {t('refcur.inUse', { desc: rateSourceText(savedRate(settings), t) })}
              </div>
            )}
            {fx && fx.source === 'fixer' && liveRate(settings.currency) > 0 && Number(liveRate(settings.currency)) !== Number(settings.usdRate) && (
              <div style={{fontSize:11, color:'var(--th)', fontFamily: 'var(--sans)'}}>
                ○ {t('refcur.fixerToday', { rate: Number(liveRate(settings.currency)).toLocaleString(moneyLocale()), date: fmtDay(fx.ts) })}
              </div>
            )}
            {fx && fx.source !== 'fixer' && (
              <div style={{fontSize:11, color:'var(--th)', fontFamily: 'var(--sans)'}}>
                ○ {t('settings.exchangeRate.offline')}
              </div>
            )}
            {settings.usdRate > 0 && (
              <div style={{fontSize:11, color:'var(--accent)', fontFamily: 'var(--sans)'}}>
                → US$1 = {Number(settings.usdRate).toLocaleString(moneyLocale())} {settings.currency} · US$100 = {(settings.usdRate * 100).toLocaleString(moneyLocale())} {settings.currency}
              </div>
            )}
          </div>
        )}
        {settings.showDualCurrency && settings.currency === 'USD' && (
          <div style={{...srow, borderBottom:'none'}}>
            <div style={{fontSize:11, color:'var(--th)', fontFamily: 'var(--sans)'}}>
              {t('settings.dualCurrency.alreadyUsd')}
            </div>
          </div>
        )}
      </Setting>
    </div>
  )
}
