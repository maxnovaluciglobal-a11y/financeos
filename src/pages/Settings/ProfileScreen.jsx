// src/pages/Settings/ProfileScreen.jsx — Ajustes › Perfil y país (R10).
// País (CountrySelect, listbox propio con CountryBadge), identificador fiscal
// según el país y la cuenta con "Cerrar sesión".
import CountrySelect from '../../components/ui/CountrySelect.jsx'
import { COUNTRIES, countryKey } from '../../data/countries.js'
import { Btn } from '../../components/ui/index.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { signOutAuth } from '../../core/auth.js'
import { validateTaxId, TAX_ID_COUNTRIES, TAX_ID_LABEL } from '../../utils/taxIdValidation.js'
import { srow, slbl, ssub, Setting } from './settingsUi.jsx'

export default function ProfileScreen({ isDemo, accountEmail }) {
  const { settings, updateSettings } = useApp()
  const { t } = useT()
  return (
    <div>
      <Setting id="country" style={srow}>
        <div><div style={slbl} id="settings-country-label">{t('settings.country.label')}</div><div style={ssub}>{t('settings.country.sub')}</div></div>
        {/* D5: CountryBadge en vez de banderas emoji. Un <option> nativo no dibuja
            SVG, por eso es un listbox propio (CountrySelect, patrón APG). */}
        <CountrySelect
          labelId="settings-country-label"
          value={settings.country || 'CL'}
          onChange={(code) => updateSettings({ ...settings, country: code })}
          options={COUNTRIES.map(c => ({ code: c.code, label: t(countryKey(c.code)) }))}
        />
      </Setting>
      <Setting id="taxId">
        <TaxIdField country={settings.country} taxId={settings.taxId} updateSettings={updateSettings} settings={settings} />
      </Setting>
      {!isDemo && accountEmail && (
        <Setting id="account" style={{ ...srow, borderBottom: 'none' }}>
          <div style={{ minWidth: 0 }}><div style={slbl}>{t('settings.account.label')}</div><div style={{ ...ssub, overflowWrap: 'anywhere' }}>{accountEmail}</div></div>
          <Btn variant="ghost" size="sm" onClick={() => signOutAuth()}>{t('settings.account.logoutBtn')}</Btn>
        </Setting>
      )}
    </div>
  )
}

// ── Identificador fiscal (RUT/RFC/CUIT/RIF/NIF/USt-IdNr/EIN según país) ────────
// Validación 100 % local (dígito verificador real para CL/MX/AR/VE/ES/PT;
// solo formato para DE/US — ver src/utils/taxIdValidation.js para el porqué).
// No se llama a VIES desde acá: el endpoint REST de VIES no manda cabeceras
// CORS, así que un fetch() desde el navegador de la app fallaría siempre.
function TaxIdField({ country, taxId, updateSettings, settings }) {
  const { t } = useT()
  const cc = (country || '').toUpperCase()
  if (!TAX_ID_COUNTRIES.includes(cc)) return null

  const label = TAX_ID_LABEL[cc]
  const result = taxId ? validateTaxId(cc, taxId) : null

  let feedback = null
  if (result) {
    if (result.valid === true) {
      feedback = { text: t('settings.taxId.valid', { label }), color: 'var(--pos)' }
    } else if (result.reason === 'checkDigit') {
      feedback = { text: t('settings.taxId.invalidCheckDigit'), color: 'var(--neg)' }
    } else if (result.reason === 'format') {
      feedback = { text: t('settings.taxId.invalidFormat', { label }), color: 'var(--neg)' }
    }
  }

  return (
    <div style={{ ...srow, flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
      <div>
        <div style={slbl}>{t('settings.taxId.title', { label })}</div>
        <div style={ssub}>{t('settings.taxId.sub')}</div>
      </div>
      <input
        type="text"
        aria-label={t('settings.taxId.title', { label })}
        value={taxId || ''}
        placeholder={t('settings.taxId.placeholder', { label })}
        onChange={e => updateSettings({ ...settings, taxId: e.target.value })}
        style={{
          width: '100%', padding: '7px 10px', minHeight: 44, borderRadius: 8, border: '.5px solid var(--brd2)',
          background: 'var(--sur2)', color: 'var(--tx)', fontSize: 13, fontFamily: 'var(--mono)',
          textTransform: 'uppercase', boxSizing: 'border-box',
        }}
      />
      {feedback && (
        <div style={{ fontSize: 11, fontFamily: 'var(--sans)', color: feedback.color }}>{feedback.text}</div>
      )}
      {result?.checkedVia === 'format-only' && (
        <div style={{ ...ssub, lineHeight: 1.5 }}>{t('settings.taxId.formatOnly', { label })}</div>
      )}
    </div>
  )
}
