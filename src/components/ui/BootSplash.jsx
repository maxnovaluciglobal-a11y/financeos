// src/components/ui/BootSplash.jsx — misma pantalla de carga que index.html
// (clases .boot/.boot-bar definidas ahí), para los pasos en que la app ya
// arrancó pero todavía verifica la sesión o la cuenta (C-32).
export default function BootSplash() {
  return (
    <div className="boot" role="status" aria-label="MOY IQ">
      <span>MOY IQ</span>
      <div className="boot-bar" />
    </div>
  )
}
