// Triggers a browser download of in-memory text (CSV export, rules JSON).
export function downloadText(text, filename, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function timestampForFilename(date = new Date()) {
  return date.toISOString().slice(0, 19).replace(/:/g, '')
}
