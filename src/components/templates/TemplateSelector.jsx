// src/components/templates/TemplateSelector.jsx
// Selector de plantillas por perfil — FinanceOS Fase 7
// Aplica categorías y presupuestos sugeridos SIN borrar transacciones reales

import { useState, useRef } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { useDialogA11y } from '../../hooks/useDialogA11y.js'
import TEMPLATES from '../../data/templates.js'

// ── MODAL BASE ─────────────────────────────────────────────────────────────
function Modal({ isOpen, onClose, children, maxWidth = 540, label }) {
  const boxRef = useRef(null)
  useDialogA11y(isOpen, onClose, boxRef)
  if (!isOpen) return null
  return (
    <div
      role="dialog" aria-modal="true" aria-label={label}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 20,
        overflowY: 'auto',
      }} onClick={onClose}>
      <div ref={boxRef} tabIndex={-1} style={{
        background: 'var(--sur)', borderRadius: 12,
        maxWidth, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,.2)',
        border: '0.5px solid var(--brd2)',
        maxHeight: '90vh', overflowY: 'auto', outline: 'none',
      }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// ── PREVIEW MODAL ──────────────────────────────────────────────────────────
function PreviewModal({ template, onClose, onApply, isAdvisor }) {
  const { t: tr } = useT()
  if (!template) return null

  const sectionTitle = {
    fontSize: 10, fontWeight: 600, color: 'var(--th)',
    textTransform: 'uppercase', letterSpacing: '0.8px',
    marginBottom: 8, fontFamily: 'var(--mono)',
  }
  const pill = (text, color) => (
    <span key={text} style={{
      display: 'inline-block', padding: '2px 8px',
      borderRadius: 20, fontSize: 10, fontFamily: 'var(--mono)',
      background: `${color}18`, color, marginRight: 4, marginBottom: 4,
      border: `0.5px solid ${color}30`,
    }}>{text}</span>
  )

  return (
    <Modal isOpen={!!template} onClose={onClose} maxWidth={580}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: '0.5px solid var(--brd)',
        background: `${template.color}08`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `${template.color}18`, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: template.color, flexShrink: 0,
          }}>{template.icon}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)' }}>{tr(`tpl.${template.id}.name`)}</div>
            <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{tr(`tpl.${template.id}.tagline`)}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.6 }}>{template.description}</div>
      </div>

      {/* Contenido */}
      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Para quién */}
        <div>
          <div style={sectionTitle}>Ideal para</div>
          {template.bestFor.map(b => (
            <div key={b} style={{ fontSize: 11, color: 'var(--tm)', padding: '3px 0', display: 'flex', gap: 6 }}>
              <span style={{ color: template.color }}>·</span> {b}
            </div>
          ))}
        </div>

        {/* Categorías de ingresos */}
        <div>
          <div style={sectionTitle}>Categorías de ingresos ({template.categoriesIncome.length})</div>
          <div>{template.categoriesIncome.map(c => pill(c, template.color))}</div>
        </div>

        {/* Categorías de gastos */}
        <div>
          <div style={sectionTitle}>Categorías de gastos ({template.categoriesExpense.length})</div>
          <div>{template.categoriesExpense.map(c => pill(c, '#7a7868'))}</div>
        </div>

        {/* Presupuestos sugeridos */}
        <div>
          <div style={sectionTitle}>Presupuestos sugeridos</div>
          {template.suggestedBudgets.map(b => (
            <div key={b.category} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '6px 0', borderBottom: '0.5px solid var(--brd)', gap: 10,
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--tx)' }}>{b.category}</div>
                <div style={{ fontSize: 11.5, color: 'var(--th)', fontFamily: 'var(--sans)', lineHeight: 1.45 }}>{b.note}</div>
              </div>
              <div style={{
                fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600,
                color: template.color, flexShrink: 0,
              }}>{b.pct}% del ingreso</div>
            </div>
          ))}
        </div>

        {/* Metas sugeridas */}
        <div>
          <div style={sectionTitle}>Metas sugeridas</div>
          {template.suggestedGoals.map(g => (
            <div key={g.name} style={{ display: 'flex', gap: 8, padding: '4px 0', alignItems: 'flex-start' }}>
              <span style={{ color: template.color, flexShrink: 0, marginTop: 1 }}>◎</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--tx)' }}>{g.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--th)', fontFamily: 'var(--sans)', lineHeight: 1.45 }}>{g.note}</div>
              </div>
              <span style={{
                marginLeft: 'auto', fontSize: 9, fontFamily: 'var(--mono)',
                flexShrink: 0, padding: '1px 7px', borderRadius: 20,
                background: g.priority === 'Alta' ? '#fdf0ee' : '#faeeda',
                color: g.priority === 'Alta' ? '#8a2020' : '#854f0b',
              }}>{g.priority}</span>
            </div>
          ))}
        </div>

        {/* Consejo del asesor — solo tiene sentido si el usuario eligió "Con clientes"
            en el onboarding. Antes se mostraba a todos, incluido quien usa la app
            para sus propias finanzas personales (que no tiene ningún "cliente"). */}
        {isAdvisor && (
          <div style={{
            padding: '10px 12px', background: 'var(--grn-bg)',
            borderRadius: 8, border: '0.5px solid rgba(26,163,104,.2)',
          }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--grn)', marginBottom: 4 }}>
              💡 Consejo para el asesor
            </div>
            <div style={{ fontSize: 11, color: 'var(--grn)', lineHeight: 1.6 }}>{template.advisorTip}</div>
          </div>
        )}

        {/* Aviso */}
        <div style={{
          padding: '10px 12px', background: '#faeeda',
          borderRadius: 8, border: '0.5px solid rgba(133,79,11,.2)',
          fontSize: 11, color: '#854f0b', fontFamily: 'var(--mono)', lineHeight: 1.5,
        }}>
          ⚠ Al aplicar esta plantilla se actualizarán las categorías y los presupuestos sugeridos.
          Tus ingresos, gastos y deudas registrados <strong>no se borrarán</strong>.
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '14px 24px', borderTop: '0.5px solid var(--brd)',
        display: 'flex', gap: 8, justifyContent: 'flex-end',
      }}>
        <button onClick={onClose} style={{
          background: 'var(--sur2)', border: '0.5px solid var(--brd2)',
          borderRadius: 6, padding: '8px 16px', fontSize: 12,
          cursor: 'pointer', color: 'var(--tm)', fontFamily: 'var(--sans)',
        }}>Cancelar</button>
        <button onClick={() => onApply(template)} style={{
          background: template.color, color: '#fff', border: 'none',
          borderRadius: 6, padding: '8px 20px', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--sans)',
        }}>Aplicar plantilla</button>
      </div>
    </Modal>
  )
}

// ── CONFIRM MODAL ──────────────────────────────────────────────────────────
function ConfirmModal({ template, hasExistingConfig, onConfirm, onCancel }) {
  if (!template) return null
  return (
    <Modal isOpen={!!template} onClose={onCancel} maxWidth={420}>
      <div style={{ padding: '24px 24px 20px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)', marginBottom: 10 }}>
          ¿Aplicar plantilla "{template.name}"?
        </div>
        <div style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.7, marginBottom: 16 }}>
          {hasExistingConfig
            ? 'Esto reemplazará las categorías y presupuestos actuales con los de esta plantilla. Tus transacciones, deudas y metas registradas no se modificarán.'
            : 'Se configurarán las categorías y presupuestos sugeridos para este perfil. Podrás editarlos después.'}
        </div>
        <div style={{
          padding: '8px 12px', background: 'var(--grn-bg)',
          borderRadius: 6, fontSize: 11, color: 'var(--grn)',
          fontFamily: 'var(--mono)', marginBottom: 20, lineHeight: 1.5,
        }}>
          ✓ Tus ingresos, gastos, deudas y metas no se borrarán.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            background: 'var(--sur2)', border: '0.5px solid var(--brd2)',
            borderRadius: 6, padding: '8px 16px', fontSize: 12,
            cursor: 'pointer', color: 'var(--tm)', fontFamily: 'var(--sans)',
          }}>Cancelar</button>
          <button onClick={onConfirm} style={{
            background: template.color, color: '#fff', border: 'none',
            borderRadius: 6, padding: '8px 20px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--sans)',
          }}>Confirmar</button>
        </div>
      </div>
    </Modal>
  )
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function TemplateSelector({ compact = false, onApplied }) {
  const { t: tr } = useT()
  const { settings, updateSettings, addBudget, budgets } = useApp()
  const [preview,  setPreview]  = useState(null)
  const [confirm,  setConfirm]  = useState(null)
  const [applied,  setApplied]  = useState(null)

  const activeTemplateId = settings.activeTemplateId

  async function applyTemplate(template) {
    setPreview(null)
    setConfirm(null)

    // 1. Actualizar settings con nuevas categorías y template activo. Los
    // presupuestos sugeridos se guardan como referencia (sin montos fijos) — el
    // asesor los configura manualmente con los montos reales del cliente.
    await updateSettings({
      ...settings,
      activeTemplateId:      template.id,
      activeTemplateName:    template.name,
      categoriesIncome:      template.categoriesIncome,
      categoriesExpense:     template.categoriesExpense,
      templateSuggestedBudgets: template.suggestedBudgets,
      templateAdvisorTip:    template.advisorTip,
      templateAlerts:        template.alerts,
    })

    // 2. #13 — Encender la diferenciación: convertir los presupuestos sugeridos
    // en presupuestos REALES (limit = ingreso declarado × pct). No-destructivo:
    // solo crea categorías que aún no tienen presupuesto, y solo si hay ingreso
    // declarado. Antes esto quedaba solo como referencia y la promesa del modal
    // ("se configurarán los presupuestos sugeridos") no se cumplía.
    const income = Number(settings.estimatedMonthlyIncome) || 0
    if (income > 0 && Array.isArray(template.suggestedBudgets)) {
      const existing = new Set((budgets || []).map(b => (b.category || '').toLowerCase()))
      for (const b of template.suggestedBudgets) {
        if (existing.has((b.category || '').toLowerCase())) continue
        const limit = Math.round(income * (Number(b.pct) || 0) / 100)
        if (limit > 0) { try { await addBudget({ category: b.category, limit }) } catch {} }
      }
    }

    setApplied(template.id)
    setTimeout(() => setApplied(null), 3000)
    onApplied?.(template)
  }

  function handleApplyClick(template) {
    const hasConfig = settings.categoriesIncome?.length > 0 || budgets.length > 0
    if (hasConfig && settings.activeTemplateId !== template.id) {
      setConfirm(template)
    } else {
      applyTemplate(template)
    }
  }

  if (compact) {
    // Versión compacta para el Modo Asesor
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--tx)', marginBottom: 4 }}>
          Plantilla activa:
          {activeTemplateId
            ? <span style={{ color: 'var(--grn)', marginLeft: 6 }}>
                {TEMPLATES.find(t => t.id === activeTemplateId)?.name || activeTemplateId}
              </span>
            : <span style={{ color: 'var(--th)', marginLeft: 6 }}>Sin plantilla</span>
          }
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => handleApplyClick(t)}
              style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 10,
                cursor: 'pointer', fontFamily: 'var(--mono)',
                background: activeTemplateId === t.id ? `${t.color}18` : 'var(--sur2)',
                color: activeTemplateId === t.id ? t.color : 'var(--th)',
                border: `0.5px solid ${activeTemplateId === t.id ? t.color + '40' : 'var(--brd)'}`,
                fontWeight: activeTemplateId === t.id ? 600 : 400,
              }}
            >
              {t.icon} {tr(`tpl.${t.id}.name`)}
            </button>
          ))}
        </div>
        <ConfirmModal
          template={confirm}
          hasExistingConfig
          onConfirm={() => applyTemplate(confirm)}
          onCancel={() => setConfirm(null)}
        />
      </div>
    )
  }

  // Versión completa — grid de tarjetas
  return (
    <div>
      {/* Plantilla activa */}
      {activeTemplateId && (
        <div style={{
          padding: '8px 12px', background: 'var(--grn-bg)',
          border: '0.5px solid rgba(26,163,104,.2)', borderRadius: 8,
          fontSize: 11, color: 'var(--grn)', fontFamily: 'var(--mono)',
          marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          ✓ Plantilla activa: <strong>{settings.activeTemplateName || activeTemplateId}</strong>
          {settings.templateAdvisorTip && (
            <span style={{ marginLeft: 8, color: 'var(--grn)', opacity: 0.7 }}>
              · {settings.templateAdvisorTip.slice(0, 60)}…
            </span>
          )}
        </div>
      )}

      {/* Grid de tarjetas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 10,
      }}>
        {TEMPLATES.map(t => {
          const isActive = activeTemplateId === t.id
          const isJustApplied = applied === t.id
          return (
            <div
              key={t.id}
              style={{
                background: isActive ? `${t.color}08` : 'var(--sur)',
                border: `0.5px solid ${isActive ? t.color + '40' : 'var(--brd)'}`,
                borderRadius: 10, padding: '14px',
                display: 'flex', flexDirection: 'column', gap: 8,
                transition: 'border-color .15s',
              }}
            >
              {/* Icon + nombre */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: `${t.color}18`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: t.color,
                }}>{t.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)', lineHeight: 1.2 }}>{tr(`tpl.${t.id}.name`)}</div>
                  {isActive && (
                    <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: t.color, marginTop: 1 }}>Activa</div>
                  )}
                </div>
              </div>

              {/* Tagline */}
              <div style={{ fontSize: 10, color: 'var(--th)', lineHeight: 1.4, fontFamily: 'var(--mono)' }}>
                {tr(`tpl.${t.id}.tagline`)}
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{
                  fontSize: 9, fontFamily: 'var(--mono)', padding: '2px 6px',
                  borderRadius: 20, background: 'var(--sur2)', color: 'var(--th)',
                }}>{t.categoriesExpense.length} categorías</span>
                <span style={{
                  fontSize: 9, fontFamily: 'var(--mono)', padding: '2px 6px',
                  borderRadius: 20, background: 'var(--sur2)', color: 'var(--th)',
                }}>{t.suggestedBudgets.length} presupuestos</span>
              </div>

              {/* Botones */}
              <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                <button
                  onClick={() => setPreview(t)}
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: 6, fontSize: 10,
                    cursor: 'pointer', border: '0.5px solid var(--brd2)',
                    background: 'var(--sur2)', color: 'var(--tm)',
                    fontFamily: 'var(--sans)',
                  }}
                >Ver más</button>
                <button
                  onClick={() => handleApplyClick(t)}
                  disabled={isActive}
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: 6, fontSize: 10,
                    fontWeight: 600, cursor: isActive ? 'default' : 'pointer',
                    border: 'none', fontFamily: 'var(--sans)',
                    background: isActive ? 'var(--sur2)' : t.color,
                    color: isActive ? 'var(--th)' : '#fff',
                    opacity: isActive ? 0.7 : 1,
                  }}
                >
                  {isJustApplied ? '✓ Aplicada' : isActive ? 'Activa' : 'Aplicar'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Nota educativa */}
      <div style={{
        marginTop: 12, padding: '10px 12px', background: 'var(--sur2)',
        borderRadius: 8, border: '0.5px solid var(--brd)',
        fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', lineHeight: 1.5,
      }}>
        Las plantillas configuran categorías y presupuestos sugeridos. Tus transacciones, deudas y metas registradas no se modifican.
        Puedes editar las categorías en cualquier momento desde Ajustes.
      </div>

      {/* Modals */}
      <PreviewModal
        template={preview}
        onClose={() => setPreview(null)}
        onApply={handleApplyClick}
        isAdvisor={compact || settings.onboardingUseType === 'advisor'}
      />
      <ConfirmModal
        template={confirm}
        hasExistingConfig
        onConfirm={() => applyTemplate(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
