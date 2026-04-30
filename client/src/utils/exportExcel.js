import * as XLSX from 'xlsx'

export function exportExcel(filename, { headers, rows, sheetName = 'Data' } = {}) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.max(h.length + 2, ...rows.map(r => String(r[i] ?? '').length), 10),
  }))
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
