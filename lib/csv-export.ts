/** Escape a CSV field (RFC-style). */
export function csvCell(v: string | number): string {
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Trigger a UTF-8 CSV download (BOM prefix for Excel). */
export function downloadCsv(filename: string, lines: string[]): void {
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
