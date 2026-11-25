import { useCallback, useEffect, useRef, useState } from 'react'
import { useLanguage } from './i18n.jsx'
import { createWeeklyReportPdf } from './reportPdf.js'
import { canSharePdfFile, normalizeWhatsAppPhone, openWhatsAppChat } from './reportSharing.js'
import './WeeklyReportPage.css'

const moodEmojis = { happy: '😊', okay: '🙂', sad: '😢', worried: '😟' }

function dateLabel(value, language) {
  const locale = language === 'kn' ? 'kn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN'
  return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

function translated(t, key, values = {}) {
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), t(key))
}

function reportText(report, t, language) {
  const tr = (key, values = {}) => translated(t, key, values)
  const medicineLines = report.medicines.length ? report.medicines.map((item) => `${item.name} (${t('dosage')}: ${item.dosage || t('notRecorded')}; ${t('reminderTimes')}: ${item.times.join(', ') || t('notRecorded')}; ${t('completed')}: ${item.completed}, ${t('missed')}: ${item.missed}, ${t('upcoming')}: ${item.upcoming})`) : [t('noMedicineScheduled')]
  const activityLines = report.activities.length ? report.activities.map((item) => `${item.name} (${t('reminderTime')}: ${item.time || t('notRecorded')}; ${t('planned')}: ${item.planned}, ${t('completed')}: ${item.completed}, ${t('pending')}: ${item.pending})`) : [t('noActivitiesScheduled')]
  const trend = report.topMood ? t(report.topMood) : t('noMoodTrend')
  return [
    t('reportTitle'), `${dateLabel(report.startDate, language)} – ${dateLabel(report.endDate, language)}`,
    '', t('moodSummary'),
    ...report.dates.map((day) => `${dateLabel(day.date, language)}: ${day.mood ? t(day.mood) : t('noCheckin')}`),
    tr('moodRecorded', { count: report.moodCount, trend }),
    tr('weeklyMoodCounts', { items: Object.entries(report.moodCounts).map(([mood, count]) => `${t(mood)}: ${count}`).join(' · ') || t('noMoodRecords') }),
    '', t('medicineReport'), t('medicineMissedNote'), ...medicineLines,
    '', t('activityReport'), ...activityLines,
    '', t('guardianDetails'),
    report.guardian.name || report.guardian.phone ? `${t('guardianName')}: ${report.guardian.name || t('notRecorded')}; ${t('phoneNumber')}: ${report.guardian.phone || t('notRecorded')}` : t('noGuardianSaved'),
    '', t('weeklyOverview'),
    `${t('medicineAdherenceMetric')}: ${report.medicineTotals.adherence === null ? t('noDueReminders') : `${report.medicineTotals.adherence}%`} (${tr('dosesMarkedTaken', { completed: report.medicineTotals.completed, due: report.medicineTotals.due })})`,
    `${t('activityCompletionMetric')}: ${report.activityTotals.completion === null ? t('noPlannedActivities') : `${report.activityTotals.completion}%`} (${tr('activitiesCompleted', { completed: report.activityTotals.completed, planned: report.activityTotals.planned })})`,
    `${t('moodCheckinsMetric')}: ${tr('moodDays', { count: report.moodCount })}${report.topMood ? ` · ${tr('mostRecorded', { mood: t(report.topMood) })}` : ` · ${t('noMoodTrendMetric')}`}`,
    t('importantObservations'), ...report.observations.map((item) => `• ${item}`),
    '', t('reportFooter'),
  ].join('\n')
}

export default function WeeklyReportPage({ report, loading, error, language = 'en' }) {
  const { t } = useLanguage()
  const pdfCache = useRef(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [pdfReady, setPdfReady] = useState(null)
  const [shareError, setShareError] = useState('')
  const [shareNotice, setShareNotice] = useState('')
  const [selectedWhatsAppNumber, setSelectedWhatsAppNumber] = useState('')
  const shareBody = report ? reportText(report, t, language) : ''
  const guardianPhone = report?.guardian?.phone?.trim() ?? ''
  const whatsappNumber = normalizeWhatsAppPhone(guardianPhone)
  const whatsappPhoneError = guardianPhone ? (whatsappNumber ? '' : 'whatsappPhoneInvalid') : 'whatsappPhoneMissing'
  const whatsappText = report ? t('whatsappShareMessage') : ''
  const fileName = `${t('pdfFileName')}-${report?.startDate}-to-${report?.endDate}.pdf`

  const getPdf = useCallback(() => {
    const key = `${language}:${JSON.stringify(report)}`
    if (pdfCache.current?.key === key) return pdfCache.current
    if (pdfCache.current?.url) URL.revokeObjectURL(pdfCache.current.url)
    const blob = createWeeklyReportPdf(report, t, language)
    if (blob.type !== 'application/pdf' || blob.size < 100) throw new Error('The generated weekly report PDF is empty or invalid.')
    const file = new File([blob], fileName, { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    pdfCache.current = { key, blob, file, url }
    return pdfCache.current
  }, [fileName, language, report, t])

  async function getVerifiedPdf() {
    const pdf = getPdf()
    const [header, trailer] = await Promise.all([
      pdf.file.slice(0, 5).text(),
      pdf.file.slice(-16).text(),
    ])
    if (header !== '%PDF-' || !trailer.trimEnd().endsWith('%%EOF')) throw new Error('The generated weekly report PDF failed validation.')
    return { ...pdf, verified: true }
  }

  function triggerPdfDownload(pdf) {
    const link = document.createElement('a')
    link.href = pdf.url
    link.download = pdf.file.name
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  useEffect(() => () => {
    if (pdfCache.current?.url) URL.revokeObjectURL(pdfCache.current.url)
  }, [])

  async function downloadPdf() {
    try {
      const pdf = await getVerifiedPdf()
      triggerPdfDownload(pdf)
      setShareError('')
      setShareNotice('')
    } catch {
      setShareError('pdfGenerationError')
      setShareOpen(true)
    }
  }

  async function openShareReview() {
    setShareError('')
    setShareNotice('')
    try {
      const pdf = await getVerifiedPdf()
      setPdfReady(pdf)
      setShareOpen(true)
    } catch {
      setShareError('pdfGenerationError')
      setShareOpen(true)
    }
  }

  function canShareFile() {
    return Boolean(pdfReady?.verified && canSharePdfFile(pdfReady.file))
  }

  async function shareNative() {
    if (!canShareFile()) return
    try {
      const name = report.guardian.name || report.userName || t('careRecipient')
      const text = translated(t, 'weeklyCareReportShareText', { name })
      await navigator.share({ files: [pdfReady.file], title: t('reportTitle'), text })
    } catch (cause) {
      if (cause.name !== 'AbortError') setShareError('shareError')
    }
  }

  function shareWhatsApp() {
    if (whatsappPhoneError) {
      setShareError(whatsappPhoneError)
      return
    }
    if (selectedWhatsAppNumber !== whatsappNumber) {
      setShareError('whatsappSelectRecipientError')
      return
    }
    if (!pdfReady?.verified) {
      setShareError('pdfGenerationError')
      return
    }
    let opened
    try { opened = openWhatsAppChat(whatsappNumber, whatsappText) } catch {
      setShareError('whatsappOpenFailed')
      return
    }
    if (!opened) {
      setShareError('whatsappOpenFailed')
      return
    }
    try {
      triggerPdfDownload(pdfReady)
      setShareError('')
      setShareNotice('whatsappPdfDownloaded')
    } catch {
      setShareError('pdfGenerationError')
    }
  }

  function shareEmail() {
    if (!window.confirm(t('emailConfirm'))) return
    const recipient = report.guardian.email || ''
    window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(t('reportEmailSubject'))}&body=${encodeURIComponent(shareBody)}`
  }

  if (loading) return <section className="care-section" role="status">{t('reportLoading')}</section>
  if (error) return <section className="care-section weekly-report-message" role="alert"><h2>{t('reportUnavailable')}</h2><p>{t('reportLoadError')}</p><a className="care-add" href="/summary">{t('backToSummary')}</a></section>
  if (!report) return <section className="care-section weekly-report-message"><p>{t('reportNoData')}</p><a className="care-add" href="/summary">{t('backToSummary')}</a></section>

  const moodTrend = report.topMood ? `${moodEmojis[report.topMood]} ${t(report.topMood)}` : t('noMoodTrend')
  return (
    <section className="weekly-report-page" aria-labelledby="weekly-report-title">
      <div className="weekly-report-toolbar">
        <a className="care-add" href="/summary">{t('backToSummary')}</a>
        <div className="weekly-report-actions">
          <button type="button" className="care-item-toggle" onClick={() => void downloadPdf()}>{t('downloadPdf')}</button>
          <button type="button" className="care-item-toggle weekly-report-share-button" onClick={openShareReview}>{t('shareReport')}</button>
        </div>
      </div>
      <p className="weekly-report-share-note">{t('shareIntro')}</p>

      <article className="weekly-report-document">
        <header className="weekly-report-heading">
          <span className="weekly-report-brand">ELDERCARE AI</span>
          <h1 id="weekly-report-title">{t('reportTitle')}</h1>
          <p>{t('reportSubtitle')}</p>
          <p>{dateLabel(report.startDate, language)} – {dateLabel(report.endDate, language)}</p>
          <p className="weekly-report-person">{t('preparedFor')} {report.userName || t('careRecipient')}</p>
        </header>
        {!report.hasData && <p className="report-empty">{t('reportNoData')}</p>}

        <section className="report-section">
          <h2><span>01</span> {t('moodSummary')}</h2>
          <p className="report-section-note">{translated(t, 'moodRecorded', { count: report.moodCount, trend: moodTrend })}</p>
          <div className="report-mood-grid">{report.dates.map((day) => <div className="report-mood-day" key={day.date}><time dateTime={day.date}>{dateLabel(day.date, language)}</time><span>{day.mood ? moodEmojis[day.mood] : '—'}</span><strong>{day.mood ? t(day.mood) : t('noCheckin')}</strong></div>)}</div>
          <p className="report-trend-line">{Object.entries(report.moodCounts).length ? translated(t, 'weeklyMoodCounts', { items: Object.entries(report.moodCounts).map(([mood, count]) => `${t(mood)}: ${count}`).join(' · ') }) : t('noMoodData')}</p>
        </section>

        <section className="report-section">
          <h2><span>02</span> {t('medicineReport')}</h2>
          <p className="report-section-note">{t('medicineMissedNote')}</p>
          {report.medicines.length ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th>{t('medicine')}</th><th>{t('dosage')}</th><th>{t('reminderTimes')}</th><th>{t('completed')}</th><th>{t('missed')}</th><th>{t('upcoming')}</th></tr></thead><tbody>{report.medicines.map((item, index) => <tr key={`${item.name}-${index}`}><th scope="row">{item.name}</th><td>{item.dosage || t('notRecorded')}</td><td>{item.times.join(', ') || t('notRecorded')}</td><td>{item.completed}</td><td>{item.missed}</td><td>{item.upcoming}</td></tr>)}</tbody></table></div> : <p className="report-empty">{t('noMedicineScheduled')}</p>}
        </section>

        <section className="report-section">
          <h2><span>03</span> {t('activityReport')}</h2>
          {report.activities.length ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th>{t('activity')}</th><th>{t('reminderTime')}</th><th>{t('planned')}</th><th>{t('completed')}</th><th>{t('pending')}</th></tr></thead><tbody>{report.activities.map((item, index) => <tr key={`${item.name}-${index}`}><th scope="row">{item.name}</th><td>{item.time || t('notRecorded')}</td><td>{item.planned}</td><td>{item.completed}</td><td>{item.pending}</td></tr>)}</tbody></table></div> : <p className="report-empty">{t('noActivitiesScheduled')}</p>}
        </section>

        <section className="report-section report-guardian">
          <h2><span>04</span> {t('guardianDetails')}</h2>
          {report.guardian.name || report.guardian.phone ? <dl><div><dt>{t('guardianName')}</dt><dd>{report.guardian.name || t('notRecorded')}</dd></div><div><dt>{t('phoneNumber')}</dt><dd>{report.guardian.phone || t('notRecorded')}</dd></div></dl> : <p className="report-empty">{t('noGuardianSaved')}</p>}
        </section>

        <section className="report-section report-overview">
          <h2><span>05</span> {t('weeklyOverview')}</h2>
          <div className="report-metrics">
            <div><small>{t('medicineAdherenceMetric')}</small><strong>{report.medicineTotals.adherence === null ? t('noDueReminders') : `${report.medicineTotals.adherence}%`}</strong><span>{translated(t, 'dosesMarkedTaken', { completed: report.medicineTotals.completed, due: report.medicineTotals.due })}</span></div>
            <div><small>{t('activityCompletionMetric')}</small><strong>{report.activityTotals.completion === null ? t('noPlannedActivities') : `${report.activityTotals.completion}%`}</strong><span>{translated(t, 'activitiesCompleted', { completed: report.activityTotals.completed, planned: report.activityTotals.planned })}</span></div>
            <div><small>{t('moodCheckinsMetric')}</small><strong>{report.moodCount} / 7</strong><span>{report.topMood ? translated(t, 'mostRecorded', { mood: t(report.topMood) }) : t('noMoodTrendMetric')}</span></div>
          </div>
          <h3>{t('importantObservations')}</h3>
          <ul>{report.observations.map((observation, index) => <li key={`${index}-${observation}`}>{observation}</li>)}</ul>
        </section>

        <footer className="weekly-report-footer">{t('reportFooter')}</footer>
      </article>
      {shareOpen && <div className="weekly-report-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShareOpen(false) }}>
        <section className="weekly-report-share-modal" role="dialog" aria-modal="true" aria-labelledby="share-report-title">
          <header><div><h2 id="share-report-title">{t('reviewShare')}</h2><p>{t('checkPdfBeforeShare')}</p></div><button type="button" className="weekly-report-modal-close" aria-label={t('closeSharing')} onClick={() => setShareOpen(false)}>×</button></header>
          {(shareError || whatsappPhoneError) && <p className="weekly-report-share-error" role="alert">{t(shareError || whatsappPhoneError)}</p>}
          {shareNotice && <p className="weekly-report-share-note" role="status">{t(shareNotice)}</p>}
          {whatsappNumber && <label className="weekly-report-recipient-choice"><input type="checkbox" checked={selectedWhatsAppNumber === whatsappNumber} onChange={(event) => setSelectedWhatsAppNumber(event.target.checked ? whatsappNumber : '')} /><span>{translated(t, 'whatsappSelectRecipient', { phone: guardianPhone })}</span></label>}
          {pdfReady?.verified && <iframe className="weekly-report-pdf-preview" src={pdfReady.url} title={t('pdfPreviewTitle')} />}
          <div className="weekly-report-share-actions">
            {canShareFile() && <button type="button" className="care-item-toggle weekly-report-share-button" onClick={shareNative}>{t('sharePdf')}</button>}
            <button type="button" className="care-item-toggle" onClick={() => void downloadPdf()}>{t('downloadPdf')}</button>
            <button type="button" className="care-item-toggle" onClick={shareWhatsApp} disabled={Boolean(whatsappPhoneError) || selectedWhatsAppNumber !== whatsappNumber || !pdfReady?.verified} title={whatsappPhoneError ? t(whatsappPhoneError) : selectedWhatsAppNumber !== whatsappNumber ? t('whatsappSelectRecipientError') : undefined}>{t('sendThroughWhatsApp')}</button>
            <button type="button" className="care-item-toggle" onClick={shareEmail}>{t('emailDraft')}</button>
          </div>
          <p className="weekly-report-share-note">{canShareFile() ? t('whatsappNativeShareHint') : `${t('whatsappAttachPdfHint')} ${translated(t, 'whatsappPhoneHint', { forName: report.guardian.name ? translated(t, 'forName', { name: report.guardian.name }) : '' })}`}</p>
        </section>
      </div>}
    </section>
  )
}
