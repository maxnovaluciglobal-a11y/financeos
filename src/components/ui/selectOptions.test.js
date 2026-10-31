import { describe, expect, it } from 'vitest'
import { createElement as h, Fragment } from 'react'
import { optionText, parseOptions } from './selectOptions.js'

describe('parseOptions', () => {
  it('lee value, texto compuesto y disabled', () => {
    const out = parseOptions([
      h('option', { key: 1, value: 'a' }, 'Uno'),
      h('option', { key: 2, value: 2, disabled: true }, ['🏠', ' ', 'Dos']),
      h('option', { key: 3 }, 'Tres'),
    ])
    expect(out).toEqual([
      { value: 'a', label: 'Uno', disabled: false, group: undefined },
      { value: '2', label: '🏠 Dos', disabled: true, group: undefined },
      { value: 'Tres', label: 'Tres', disabled: false, group: undefined },
    ])
  })
  it('entra en optgroup y Fragment, y salta lo que no es opción', () => {
    const out = parseOptions(h(Fragment, null,
      false,
      h('optgroup', { label: 'G' }, h('option', { value: 'x' }, 'X')),
      h(Fragment, null, h('option', { value: 'y' }, 'Y')),
    ))
    expect(out.map(o => [o.value, o.group])).toEqual([['x', 'G'], ['y', undefined]])
  })
  it('optionText no imprime booleanos ni null', () => {
    expect(optionText([null, false, 'a', 1])).toBe('a1')
  })
})
