// src/pages/Settings/DataScreen.jsx — Ajustes › Datos y respaldo (R10).
// Respaldo y restauración (único primario Latón: "Crear respaldo"), la copia
// previa a los fijos, sincronización entre dispositivos, exportar CSV y dónde
// se guardan los datos. Cada bloque separado por una línea fina (regla 1).
import { Lock } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { Btn } from '../../components/ui/index.jsx'
import BackupManager from '../../components/backup/BackupManager.jsx'
import SnapshotRestore from '../../components/recurring/SnapshotRestore.jsx'
import SyncSection from './SyncSection.jsx'
import { useT } from '../../i18n/useT.js'
import { srow, slbl, ssub, Setting } from './settingsUi.jsx'

const block = { borderTop: '1px solid var(--brd2)', paddingTop: 14, marginTop: 18 }
const h3 = { margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--tx)' }

export default function DataScreen() {
  const { exportCSV } = useApp()
  const { t } = useT()
  return (
    <div>
      <Setting id="backup">
        <h3 style={{ ...h3, marginTop: 4 }}>{t('settings.backup.title')}</h3>
        <BackupManager />
        <SnapshotRestore />
      </Setting>

      <Setting id="sync" style={block}>
        <h3 style={h3}>{t('settings.sync.title')}</h3>
        <SyncSection />
      </Setting>

      <Setting id="csv" style={{ ...block, paddingTop: 0 }}>
        <div style={{ ...srow, borderBottom: 'none' }}>
          <div><div style={slbl}>{t('settings.exportCsv.label')}</div><div style={ssub}>{t('settings.exportCsv.sub')}</div></div>
          <Btn variant="ghost" size="sm" onClick={exportCSV}>{t('settings.exportCsv.btn')}</Btn>
        </div>
      </Setting>

      <Setting id="storage" style={block}>
        <h3 style={h3}>{t('settings.dataStorage.title')}</h3>
        <div style={{fontSize:12,color:'var(--tm)',lineHeight:1.8,display:'flex',flexDirection:'column',gap:8}}>
          <div><span style={{fontWeight:600,color:'var(--tx)'}}>{t('settings.dataStorage.indexeddbLabel')}</span> — {t('settings.dataStorage.indexeddbDesc')}</div>
          <div><span style={{fontWeight:600,color:'var(--tx)'}}>{t('settings.dataStorage.serverLabel')}</span> — {t('settings.dataStorage.serverDesc')}</div>
          <div><span style={{fontWeight:600,color:'var(--tx)'}}>{t('settings.dataStorage.backupLabel')}</span> — {t('settings.dataStorage.backupDesc')}</div>
          <div style={{fontSize:12,fontFamily: 'var(--sans)',color:'var(--th)',marginTop:4}}><Lock size={12} strokeWidth={1.7} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 5, flexShrink: 0 }} />{t('settings.dataStorage.privacyBadge')}</div>
        </div>
      </Setting>
    </div>
  )
}
