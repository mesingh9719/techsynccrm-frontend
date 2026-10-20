/** Excel/Sheets TSV with quoted tabs, newlines, and escaped quotes. Never interprets formulas. */
export function parseClipboard(text: string): string[][] {
  const rows: string[][] = [[]]
  let value = '', quoted = false
  const input = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let index = 0; index < input.length; index++) {
    const char = input[index]
    if (char === '"') {
      if (quoted && input[index + 1] === '"') { value += '"'; index++ }
      else if (quoted || !value) quoted = !quoted
      else value += char
    } else if (!quoted && (char === '\t' || char === '\n')) {
      rows[rows.length - 1].push(value); value = ''
      if (char === '\n') rows.push([])
    } else value += char
  }
  if (quoted) throw new Error('The pasted range contains an unclosed quote.')
  rows[rows.length - 1].push(value)
  if (input.endsWith('\n') && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop()
  return rows
}
export function copyClipboard(rows: string[][]): string {
  return rows.map((row) => row.map((value) => {
    // Prevent spreadsheet formula execution when copied out of the CRM.
    const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? `'${value}` : value
    return /[\t\n\r"]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
  }).join('\t')).join('\n')
}
export function columnLetter(index: number) {
  let result = '', value = index + 1
  while (value) { value--; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26) }
  return result
}
