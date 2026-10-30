// src/pages/Settings/DangerScreen.jsx — Ajustes › Zona de riesgo (R10).
// Las dos acciones que no se deshacen, aisladas y en rojo (nunca Latón), cada
// una con su confirmación de siempre: "Borrar todos los datos" (confirmación
// en línea) y "Eliminar la cuenta" (respaldo + palabra de confirmación).
import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { Btn } from '../../components/ui/index.jsx'
import { useT } from '../../i18n/useT.js'
import DeleteAccountSection from './DeleteAccountSection.jsx'
import { srow, slbl, ssub, Setting } from './settingsUi.jsx'

export default function DangerScreen({ isDemo, accountEmail, autoOpenDelete }) {
  const { clearAll } = useApp()
  const { t } = useT()
  const [confirming, setConfirming] = useState(false)

  async function handleClear() {
    setConfirming(false)
    await clearAll()
  }

  return (
    <div>
      <p style={{ ...ssub, fontSize: 12, lineHeight: 1.6, margin: '0 0 6px' }}>{t('settings.group.danger.intro')}</p>
      <Setting id="clearAll" style={{ marginBottom: 16 }}>
        {confirming ? (
          <div role="group" aria-label={t('settings.clearAll.label')} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',margin:'11px 0',background:'var(--red-bg)',borderRadius:8,border:'0.5px solid var(--red)',flexWrap:'wrap'}}>
            <span style={{fontSize:12,color:'var(--tx)',fontFamily: 'var(--sans)',flex:1}}>{t('settings.confirmDeleteAll')}</span>
            <div style={{display:'flex',gap:6}}>
              <Btn variant="danger" size="xs" onClick={handleClear}>{t('debts.card.confirm')}</Btn>
              <Btn variant="ghost" size="xs" onClick={()=>setConfirming(false)}>{t('common.cancel')}</Btn>
            </div>
          </div>
        ) : (
          <div style={{ ...srow, borderBottom: 'none' }}>
            <div><div style={{ ...slbl, color: 'var(--red)' }}>{t('settings.clearAll.label')}</div><div style={ssub}>{t('settings.clearAll.sub')}</div></div>
            <Btn variant="danger" size="sm" onClick={()=>setConfirming(true)}>{t('settings.clearAll.btn')}</Btn>
          </div>
        )}
      </Setting>
      {!isDemo && accountEmail && (
        <Setting id="deleteAccount">
          <DeleteAccountSection autoOpen={autoOpenDelete} />
        </Setting>
      )}
    </div>
  )
}
