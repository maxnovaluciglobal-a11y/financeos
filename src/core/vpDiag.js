// src/core/vpDiag.js — Diagnóstico de viewport en el teléfono (19-nov-2026).
// Oculto: 5 toques seguidos en la esquina superior izquierda (60×60) en menos
// de 3 s muestran un panel con lo que informa el navegador. Solo lee valores;
// otro toque en el panel lo cierra. Sirve para depurar la app instalada de iOS,
// donde no hay herramientas de desarrollo a mano.
export function installVpDiag(win = window) {
  const doc = win.document
  let taps = []
  const measure = () => {
    const probe = doc.createElement('div')
    probe.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)'
    doc.body.appendChild(probe)
    const r = probe.getBoundingClientRect(); const cs = win.getComputedStyle(probe)
    probe.remove()
    const root = doc.documentElement; const rcs = win.getComputedStyle(root)
    const bar = doc.querySelector('nav[class*="tabbar"], [class*="tabbar"]')
    const br = bar?.getBoundingClientRect()
    return {
      standalone: win.navigator.standalone, displayStandalone: win.matchMedia?.('(display-mode: standalone)').matches,
      inner: `${win.innerWidth}x${win.innerHeight}`, screen: `${win.screen.width}x${win.screen.height}`,
      vv: win.visualViewport ? `${Math.round(win.visualViewport.width)}x${Math.round(win.visualViewport.height)} top ${Math.round(win.visualViewport.offsetTop)}` : null,
      docClientH: root.clientHeight, fixedBottom: Math.round(r.bottom),
      safeTop: cs.paddingTop, safeBottom: cs.paddingBottom,
      appH: rcs.getPropertyValue('--app-h'), vpGap: rcs.getPropertyValue('--vp-gap'),
      tabbarH: rcs.getPropertyValue('--tabbar-h'), tabbarSafe: rcs.getPropertyValue('--tabbar-safe'),
      vpFit: root.dataset.vpFit ?? null, chrome: root.dataset.chrome ?? null,
      tabbar: br ? `top ${Math.round(br.top)} bottom ${Math.round(br.bottom)} h ${Math.round(br.height)} display ${win.getComputedStyle(bar).display}` : 'no encontrada',
      dpr: win.devicePixelRatio, ua: win.navigator.userAgent.replace(/.*OS ([\d_]+).*/, 'iOS $1'),
    }
  }
  const show = () => {
    const box = doc.createElement('pre')
    box.textContent = JSON.stringify(measure(), null, 1)
    box.style.cssText = 'position:fixed;z-index:99999;top:env(safe-area-inset-top);left:8px;right:8px;margin:0;padding:10px;font:11px/1.35 ui-monospace,Menlo,monospace;color:#fff;background:rgba(28,29,33,.92);border-radius:12px;white-space:pre-wrap;word-break:break-all'
    box.addEventListener('click', () => box.remove())
    doc.body.appendChild(box)
  }
  doc.addEventListener('pointerdown', (e) => {
    if (e.clientX > 60 || e.clientY > 60) { taps = []; return }
    const t = Date.now(); taps = taps.filter((x) => t - x < 3000); taps.push(t)
    if (taps.length >= 5) { taps = []; show() }
  }, { passive: true })
}
