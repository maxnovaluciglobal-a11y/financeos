// src/pages/legal/companyBlock.jsx
// Bloque de identificación de la empresa para Términos y Privacidad (es/en/pt/de).
import React from 'react' // eslint-disable-line no-unused-vars
import s from './legal.module.css'
import { COMPANY, SUPPORT_EMAIL } from './legalMeta.js'

const FORM = {
  es: 'Sociedad de responsabilidad limitada (LLC) de Florida, EE. UU.',
  en: 'Florida limited liability company, USA',
  pt: 'Sociedade de responsabilidade limitada (LLC) da Flórida, EUA',
  de: 'Limited Liability Company nach dem Recht des US-Bundesstaates Florida',
}
const COUNTRY = { es: 'EE. UU.', en: 'USA', pt: 'EUA', de: 'USA' }

export function CompanyBlock({ lang }) {
  const l = FORM[lang] ? lang : 'es'
  return (
    <address className={s.company}>
      <strong>{COMPANY.name}</strong>
      <br />
      {FORM[l]} · Florida Division of Corporations, Document Number {COMPANY.documentNumber}
      <br />
      {COMPANY.address}, {COUNTRY[l]}
      <br />
      Email: {SUPPORT_EMAIL}
    </address>
  )
}
