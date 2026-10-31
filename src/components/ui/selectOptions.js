// src/components/ui/selectOptions.js — lee los <option> de un <select> escrito en
// JSX. Puro: SheetSelect conserva el JSX de cada pantalla (mismos hijos, mismo
// onChange) y solo cambia cómo se elige en el teléfono.
import { Children, Fragment, isValidElement } from 'react'

export function optionText(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(optionText).join('')
  if (isValidElement(node)) return optionText(node.props.children)
  return ''
}

export function parseOptions(children) {
  const out = []
  const walk = (nodes, group) => {
    Children.forEach(nodes, (c) => {
      if (!isValidElement(c)) return
      if (c.type === 'option') {
        const label = optionText(c.props.children)
        out.push({ value: String(c.props.value ?? label), label, disabled: !!c.props.disabled, group })
      } else if (c.type === 'optgroup') {
        walk(c.props.children, c.props.label)
      } else if (c.type === Fragment) {
        walk(c.props.children, group)
      }
    })
  }
  walk(children, undefined)
  return out
}
