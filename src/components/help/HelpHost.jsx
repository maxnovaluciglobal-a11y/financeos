// src/components/help/HelpHost.jsx — lo que la ayuda muestra (diferido): el
// panel de la pantalla, la pregunta de la primera visita y el recorrido. Shell
// lo monta solo cuando useHelp tiene algo abierto. Todo va dentro del Gate de
// los textos de la ayuda (src/i18n/help/): nunca se ve una clave cruda.
import { useEffect } from 'react'
import { HelpStringsGate } from '../../i18n/help/index.js'
import Tour from '../tour/Tour.jsx'
import { PAGE_TOURS } from '../tour/pageTours.js'
import HelpPanel from './HelpPanel.jsx'
import FirstVisitPrompt from './FirstVisitPrompt.jsx'
import { anyTargetVisible } from './tourTargets.js'

// Al terminar un recorrido o la pregunta, el foco vuelve al "?" que se ve: el
// de la barra superior o, en el Inicio del teléfono, el de su cabecera.
const focusHelpButton = () => setTimeout(() => {
  const btn = [...document.querySelectorAll('[data-help-btn]')].find(el => el.getClientRects().length > 0)
  btn?.focus({ preventScroll: true })
}, 80)

function PromptGate({ page, onAccept, onDismiss, onSkip }) {
  // Sin ningún objetivo a la vista (pantalla vacía, sin el plan) no se pregunta
  // ni se marca: se vuelve a ofrecer cuando haya algo que mostrar.
  const ok = anyTargetVisible(PAGE_TOURS[page])
  useEffect(() => { if (!ok) onSkip() }, [ok, onSkip])
  if (!ok) return null
  return <FirstVisitPrompt page={page} onAccept={onAccept} onDismiss={() => { onDismiss(); focusHelpButton() }} />
}

export default function HelpHost({ help, page, navigate, country, settings }) {
  return (
    <HelpStringsGate>
      {help.panel && (
        <HelpPanel page={page} onClose={help.closePanel} onStartTour={help.startTour} navigate={navigate}
          country={country} settings={settings} />
      )}
      {help.prompt === page && !help.panel && !help.tour && (
        <PromptGate page={page} onAccept={help.acceptPrompt} onDismiss={help.dismissPrompt} onSkip={help.skipPrompt} />
      )}
      {help.tour === page && PAGE_TOURS[page] && (
        <Tour key={page} open steps={PAGE_TOURS[page]} onClose={() => { help.closeTour(); focusHelpButton() }} />
      )}
    </HelpStringsGate>
  )
}
