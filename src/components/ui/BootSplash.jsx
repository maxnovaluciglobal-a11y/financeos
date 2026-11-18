// src/components/ui/BootSplash.jsx — misma pantalla de carga que index.html
// (clases .boot/.boot-logo/.boot-bar definidas ahí), para los pasos en que la
// app ya arrancó pero todavía verifica la sesión o la cuenta (C-32). Usa el
// mismo logotipo SVG que index.html para que no haya salto visual.
import { LOGO_SVG } from '../logoPaths.js'

export default function BootSplash() {
  return (
    <div className="boot" role="status" aria-label="moyiq">
      <svg className="boot-logo" xmlns="http://www.w3.org/2000/svg" viewBox={LOGO_SVG.viewBox} fill="currentColor" aria-hidden="true" focusable="false">
        {LOGO_SVG.paths.map((d, i) => <path key={i} d={d} />)}
      </svg>
      <div className="boot-bar" />
    </div>
  )
}
