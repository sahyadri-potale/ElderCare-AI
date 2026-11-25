export function normalizeWhatsAppPhone(value = '') {
  const input = String(value).trim()
  if (!input || !/^\+?[\d\s().-]+$/.test(input)) return ''
  const international = input.startsWith('+') || input.startsWith('00')
  let digits = input.replace(/\D/g, '')
  if (input.startsWith('00')) digits = digits.slice(2)
  if (international) return digits.length >= 8 && digits.length <= 15 && /^[1-9]/.test(digits) ? digits : ''

  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10) return /^[6-9]/.test(digits) ? `91${digits}` : ''
  return digits.length >= 11 && digits.length <= 15 && /^[1-9]/.test(digits) ? digits : ''
}

export function buildWhatsAppShareUrl(phone, message) {
  const number = normalizeWhatsAppPhone(phone)
  if (!number) throw new Error('A valid WhatsApp phone number is required.')
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export function openWhatsAppChat(phone, message, openWindow = (url, target) => window.open(url, target)) {
  const url = buildWhatsAppShareUrl(phone, message)
  const whatsappWindow = openWindow(url, '_blank')
  if (!whatsappWindow) return false
  try { whatsappWindow.opener = null } catch { /* Cross-origin window proxies may reject opener updates. */ }
  return true
}

export function canSharePdfFile(file, shareApi = globalThis.navigator) {
  if (!file || typeof shareApi?.share !== 'function' || typeof shareApi?.canShare !== 'function') return false
  try { return shareApi.canShare({ files: [file] }) } catch { return false }
}

export async function sharePdfFile(file, title, text, shareApi = globalThis.navigator) {
  if (!canSharePdfFile(file, shareApi)) return false
  await shareApi.share({ files: [file], title, text })
  return true
}
