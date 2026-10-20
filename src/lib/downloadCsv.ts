/** Browser export of already-authorized displayed data. Neutralize spreadsheet formulas. */
export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const cell = (value: unknown) => {
    let text = value == null ? '' : String(value)
    if (/^[=+@-]/.test(text.trimStart()) || text.startsWith('\t') || text.startsWith('\r')) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  const blob = new Blob(['\uFEFF', [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob),
    anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
