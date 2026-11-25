// src/utils/investXlsx.js — Excel (.xlsx) → tabla para el importador con
// columnas (investMappedImport.js). exceljs se baja solo al elegir un Excel,
// en su propio chunk (el mismo de Importar movimientos): un CSV no lo necesita.
import { tableFrom, xlsxCell } from './investMappedImport.js'

export async function xlsxTable(arrayBuffer, load = () => import('exceljs')) {
  const ExcelJS = (await load()).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(arrayBuffer)
  const ws = wb.worksheets[0]
  if (!ws) return { error: 'no_rows' }
  const cells = [], nums = []
  // row.number = número de fila en Excel (los errores dicen esa fila).
  ws.eachRow({ includeEmpty: true }, (row) => { cells.push((row.values || []).slice(1).map(xlsxCell)); nums.push(row.number ?? nums.length + 1) })
  return tableFrom(cells, nums)
}
