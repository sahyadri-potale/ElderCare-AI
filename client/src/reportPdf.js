const PAGE_WIDTH = 1240
const PAGE_HEIGHT = 1754
const MARGIN = 92
const encoder = new TextEncoder()

function reportLines(report, t, language) {
  const tr = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), t(key))
  const dateLabel = (value) => new Intl.DateTimeFormat(language === 'kn' ? 'kn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
  const number = (value) => new Intl.NumberFormat(language === 'kn' ? 'kn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN').format(value)
  const moodName = (mood) => mood ? t(mood) : t('noCheckin')
  const lines = [
    { type: 'brand', text: 'ELDERCARE AI' },
    { type: 'title', text: t('reportTitle') },
    { type: 'subtitle', text: `${dateLabel(report.startDate)} – ${dateLabel(report.endDate)}` },
    { type: 'body', text: `${t('preparedFor')} ${report.userName || t('careRecipient')}` },
    { type: 'space' },
    { type: 'section', text: `01  ${t('moodSummary')}` },
    { type: 'body', text: tr('moodRecorded', { count: number(report.moodCount), trend: report.topMood ? t(report.topMood) : t('noMoodTrend') }) },
    ...report.dates.map((day) => ({ type: 'body', text: `${dateLabel(day.date)}: ${moodName(day.mood)}` })),
    { type: 'body', text: tr('weeklyMoodCounts', { items: Object.entries(report.moodCounts).map(([mood, count]) => `${t(mood)} ${number(count)}`).join(' | ') || t('noMoodRecords') }) },
    { type: 'space' },
    { type: 'section', text: `02  ${t('medicineReport')}` },
    { type: 'note', text: t('medicineMissedNote') },
    ...(report.medicines.length ? report.medicines.flatMap((item) => [
      { type: 'row-title', text: item.name },
      { type: 'body', text: `${t('dosage')}: ${item.dosage || t('notRecorded')}  |  ${t('reminderTimes')}: ${item.times.join(', ') || t('notRecorded')}` },
      { type: 'body', text: `${t('completed')}: ${number(item.completed)}  |  ${t('missed')}: ${number(item.missed)}  |  ${t('upcoming')}: ${number(item.upcoming)}` },
    ]) : [{ type: 'body', text: t('noMedicineScheduled') }]),
    { type: 'space' },
    { type: 'section', text: `03  ${t('activityReport')}` },
    ...(report.activities.length ? report.activities.flatMap((item) => [
      { type: 'row-title', text: item.name },
      { type: 'body', text: `${t('reminderTime')}: ${item.time || t('notRecorded')}  |  ${t('planned')}: ${number(item.planned)}  |  ${t('completed')}: ${number(item.completed)}  |  ${t('pending')}: ${number(item.pending)}` },
    ]) : [{ type: 'body', text: t('noActivitiesScheduled') }]),
    { type: 'space' },
    { type: 'section', text: `04  ${t('guardianDetails')}` },
    { type: 'body', text: `${t('guardianName')}: ${report.guardian.name || t('notRecorded')}` },
    { type: 'body', text: `${t('phoneNumber')}: ${report.guardian.phone || t('notRecorded')}` },
    { type: 'space' },
    { type: 'section', text: `05  ${t('weeklyOverview')}` },
    { type: 'body', text: `${t('medicineAdherenceMetric')}: ${report.medicineTotals.adherence === null ? t('noDueReminders') : `${number(report.medicineTotals.adherence)}%`} (${tr('dosesMarkedTaken', { completed: number(report.medicineTotals.completed), due: number(report.medicineTotals.due) })})` },
    { type: 'body', text: `${t('activityCompletionMetric')}: ${report.activityTotals.completion === null ? t('noPlannedActivities') : `${number(report.activityTotals.completion)}%`} (${tr('activitiesCompleted', { completed: number(report.activityTotals.completed), planned: number(report.activityTotals.planned) })})` },
    { type: 'body', text: `${t('moodCheckinsMetric')}: ${tr('moodDays', { count: number(report.moodCount) })}${report.topMood ? `  |  ${tr('mostRecorded', { mood: t(report.topMood) })}` : ''}` },
    { type: 'subheading', text: t('importantObservations') },
    ...report.observations.map((observation) => ({ type: 'bullet', text: observation })),
    { type: 'space' },
    { type: 'note', text: t('reportFooter') },
  ]
  return lines
}
function createPage(t) {
  const canvas = document.createElement('canvas')
  canvas.width = PAGE_WIDTH
  canvas.height = PAGE_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error(t('pdfGenerationError'))
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
  context.textBaseline = 'top'
  return { canvas, context, y: MARGIN }
}

function wrapText(context, text, maxWidth) {
  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = word
    } else line = candidate
  }
  if (line) lines.push(line)
  return lines
}

function renderReportPages(report, t, language) {
  const pages = []
  let page = createPage(t)
  const maxWidth = PAGE_WIDTH - MARGIN * 2
  const locale = language === 'kn' ? 'kn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN'
  const dateLabel = (value) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`))
  const startPage = () => {
    page.context.fillStyle = '#57866b'
    page.context.fillRect(MARGIN, MARGIN, 7, 52)
    page.context.fillStyle = '#57866b'
    page.context.font = '700 21px Arial, sans-serif'
    page.context.fillText(t('pdfHeader'), MARGIN + 20, MARGIN + 4)
    page.context.strokeStyle = '#dfeae3'
    page.context.beginPath()
    page.context.moveTo(MARGIN, PAGE_HEIGHT - MARGIN)
    page.context.lineTo(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN)
    page.context.stroke()
    page.context.fillStyle = '#829187'
    page.context.font = '16px Arial, sans-serif'
    page.context.fillText(`${dateLabel(report.startDate)} – ${dateLabel(report.endDate)}`, MARGIN, PAGE_HEIGHT - MARGIN + 14)
    page.context.textAlign = 'right'
    page.context.fillText(t('pageLabel').replace('{number}', new Intl.NumberFormat(language === 'kn' ? 'kn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN').format(pages.length + 1)), PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN + 14)
    page.context.textAlign = 'left'
    page.y = MARGIN + 78
  }
  const newPage = () => {
    pages.push(page.canvas)
    page = createPage(t)
    startPage()
  }
  const write = (text, { font = '20px Arial, sans-serif', color = '#29483b', indent = 0, gap = 11, lineHeight = 31 } = {}) => {
    page.context.font = font
    const lines = wrapText(page.context, text, maxWidth - indent)
    for (const line of lines) {
      if (page.y + lineHeight > PAGE_HEIGHT - MARGIN - 44) newPage()
      page.context.font = font
      page.context.fillStyle = color
      page.context.fillText(line, MARGIN + indent, page.y, maxWidth - indent)
      page.y += lineHeight
    }
    page.y += gap
  }

  page.context.fillStyle = '#57866b'
  page.context.font = '800 20px Arial, sans-serif'
  page.context.fillText('ELDERCARE AI', MARGIN, page.y)
  page.y += 42
  write(t('reportTitle'), { font: '700 38px Arial, sans-serif', color: '#29483b', lineHeight: 48, gap: 6 })
  const dateRange = `${dateLabel(report.startDate)} – ${dateLabel(report.endDate)}`
  write(dateRange, { font: '21px Arial, sans-serif', color: '#65796c', lineHeight: 30, gap: 3 })
  write(`${t('preparedFor')} ${report.userName || t('careRecipient')}`, { font: '600 20px Arial, sans-serif', color: '#526e5d', lineHeight: 30, gap: 25 })

  for (const item of reportLines(report, t, language).slice(5)) {
    if (item.type === 'space') { page.y += 8; continue }
    if (item.type === 'section') write(item.text, { font: '700 27px Arial, sans-serif', color: '#355946', lineHeight: 36, gap: 14 })
    else if (item.type === 'row-title') write(item.text, { font: '700 21px Arial, sans-serif', color: '#355946', indent: 12, lineHeight: 29, gap: 2 })
    else if (item.type === 'subheading') write(item.text, { font: '700 21px Arial, sans-serif', color: '#355946', lineHeight: 30, gap: 7 })
    else if (item.type === 'bullet') write(`• ${item.text}`, { font: '19px Arial, sans-serif', color: '#526e5d', indent: 8, lineHeight: 29, gap: 3 })
    else if (item.type === 'note') write(item.text, { font: 'italic 17px Arial, sans-serif', color: '#71857a', lineHeight: 25, gap: 8 })
    else write(item.text, { font: '19px Arial, sans-serif', color: '#405b4b', indent: item.type === 'body' ? 10 : 0, lineHeight: 29, gap: item.type === 'body' ? 2 : 8 })
  }
  pages.push(page.canvas)
  return pages
}

function base64Bytes(dataUrl) {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function joinBytes(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
  return result
}

function makePdf(canvases) {
  const objectCount = 2 + canvases.length * 3
  const objects = new Array(objectCount + 1)
  objects[1] = encoder.encode('<< /Type /Catalog /Pages 2 0 R >>')
  const pageRefs = canvases.map((_, index) => `${3 + index * 3} 0 R`).join(' ')
  objects[2] = encoder.encode(`<< /Type /Pages /Kids [${pageRefs}] /Count ${canvases.length} >>`)

  canvases.forEach((canvas, index) => {
    const pageObject = 3 + index * 3
    const imageObject = pageObject + 1
    const contentObject = pageObject + 2
    const jpeg = base64Bytes(canvas.toDataURL('image/jpeg', 0.94))
    objects[pageObject] = encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`)
    objects[imageObject] = joinBytes([
      encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
      jpeg,
      encoder.encode('\nendstream'),
    ])
    const stream = encoder.encode('q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n')
    objects[contentObject] = joinBytes([encoder.encode(`<< /Length ${stream.length} >>\nstream\n`), stream, encoder.encode('endstream')])
  })

  const header = new Uint8Array([...encoder.encode('%PDF-1.4\n%'), 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])
  const chunks = [header]
  const offsets = new Array(objectCount + 1).fill(0)
  let offset = header.length
  for (let number = 1; number <= objectCount; number += 1) {
    const chunk = joinBytes([encoder.encode(`${number} 0 obj\n`), objects[number], encoder.encode('\nendobj\n')])
    offsets[number] = offset
    chunks.push(chunk)
    offset += chunk.length
  }
  const xrefOffset = offset
  let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`
  for (let number = 1; number <= objectCount; number += 1) xref += `${String(offsets[number]).padStart(10, '0')} 00000 n \n`
  xref += `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  chunks.push(encoder.encode(xref))
  return new Blob(chunks, { type: 'application/pdf' })
}

export function createWeeklyReportPdf(report, t, language = 'en') {
  return makePdf(renderReportPages(report, t, language))
}
