import { useCallback, useEffect, useState } from 'react'
import './App.css'
import AuthPage from './AuthPage.jsx'
import { getBackendHealth } from './api.js'
import { clearAuthToken, getAuthToken, getCurrentUser } from './api.js'
import Dashboard from './Dashboard.jsx'
import ReminderScheduler from './ReminderScheduler.jsx'
import { LanguageSelector, useLanguage } from './i18n.jsx'
import { resolveAppRoute } from './pageRoutes.js'

const features = [
  { icon: 'reminder', titleKey: 'featureMedicineTitle', textKey: 'featureMedicineText', href: '/reminders', tint: 'mint' },
  { icon: 'checklist', titleKey: 'featureActivitiesTitle', textKey: 'featureActivitiesText', href: '/activities', tint: 'peach' },
  { icon: 'mood', titleKey: 'featureMoodTitle', textKey: 'featureMoodText', href: '/mood', tint: 'lavender' },
  { icon: 'voice', titleKey: 'featureAssistantTitle', textKey: 'featureAssistantText', href: '/assistant', tint: 'rose' },
  { icon: 'emergency', titleKey: 'featureContactsTitle', textKey: 'featureContactsText', href: '/contacts', tint: 'blue' },
  { icon: 'family', titleKey: 'featureCarePlanTitle', textKey: 'featureCarePlanText', href: '/care-plan', tint: 'blue' },
  { icon: 'summary', titleKey: 'featureSummaryTitle', textKey: 'featureSummaryText', href: '/summary', tint: 'mint' },
]

const steps = [
  {
    number: '01',
    icon: 'talk',
    titleKey: 'stepTalkTitle',
    textKey: 'stepTalkText',
  },
  {
    number: '02',
    icon: 'checklist',
    titleKey: 'stepManageTitle',
    textKey: 'stepManageText',
  },
  {
    number: '03',
    icon: 'people',
    titleKey: 'stepFamilyTitle',
    textKey: 'stepFamilyText',
  },
]

function Icon({ name, className = '' }) {
  const paths = {
    voice: <><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v4m-4 0h8"/></>,
    reminder: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/><path d="m9.5 11 1.7 1.7 3.5-3.5"/></>,
    heart: <><path d="M20.8 8.8c0 5.2-8.8 10.1-8.8 10.1S3.2 14 3.2 8.8a4.8 4.8 0 0 1 8.8-2.6 4.8 4.8 0 0 1 8.8 2.6Z"/><path d="M7.5 11.5h2.7l1.4-2.4 2.1 4 1.4-2h1.5"/></>,
    mood: <><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.2 2 3.5 2 3.5-2 3.5-2M9 9h.01M15 9h.01"/></>,
    family: <><circle cx="9" cy="8" r="3.5"/><path d="M2.8 20v-1a6.2 6.2 0 0 1 6.2-6.2h.5a6.2 6.2 0 0 1 6.2 6.2v1M16 5a3.5 3.5 0 0 1 0 6.8m1.7 2a5.7 5.7 0 0 1 3.5 5.2v1"/></>,
    language: <><circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
    talk: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.6 8.6 0 0 1-3.7-.8L4 20l1.4-3.6A7.2 7.2 0 0 1 4 12c0-4.1 3.6-7.5 8-7.5s8 3.1 8 7Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></>,
    checklist: <><rect x="5" y="3.5" width="14" height="18" rx="2"/><path d="M9 3.5v-1h6v1M8.5 10l1.3 1.3 2.2-2.2m2.5 1h2m-8 5 1.3 1.3 2.2-2.2m2.5 1h2"/></>,
    people: <><circle cx="9" cy="8" r="3.2"/><path d="M3 20v-1.2a6 6 0 0 1 6-6h.5a6 6 0 0 1 6 6V20m.1-14.6a3.2 3.2 0 0 1 0 5.3m2.1 2.5a5.5 5.5 0 0 1 3.3 5V20"/></>,
    emergency: <><path d="M12 3 3.5 7v5c0 5 3.4 8 8.5 9 5.1-1 8.5-4 8.5-9V7L12 3Z"/><path d="M12 8v5m0 3h.01"/></>,
    summary: <><path d="M4 19V5m0 14h17"/><path d="m7 15 4-4 3 2 5-6"/><circle cx="7" cy="15" r="1"/><circle cx="11" cy="11" r="1"/><circle cx="14" cy="13" r="1"/><circle cx="19" cy="7" r="1"/></>,
  }

  return (
    <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function Brand({ light = false, href = '#home' }) {
  const { t } = useLanguage()
  return (
    <a className={`brand${light ? ' brand--light' : ''}`} href={href} aria-label={t('brandHomeAria')}>
      <span className="brand-icon" aria-hidden="true">
        <svg viewBox="0 0 42 42" fill="none"><rect width="42" height="42" rx="15" fill="currentColor"/><path d="M21 30s-10-6-10-12.3a5.5 5.5 0 0 1 10-3.1 5.5 5.5 0 0 1 10 3.1C31 24 21 30 21 30Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/><path d="M14 20.5h4l2-3 3.2 6 2-3H28" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </span>
      <span className="brand-type">ElderCare <span>AI</span></span>
    </a>
  )
}

function HeroArtwork() {
  const { t } = useLanguage()
  return (
    <div className="hero-visual" role="img" aria-label={t('heroArtworkAlt')}>
      <div className="visual-glow" />
      <div className="visual-ring visual-ring--outer" />
      <div className="visual-ring visual-ring--inner" />
      <span className="visual-star visual-star--one">✦</span>
      <span className="visual-star visual-star--two">✦</span>
      <div className="chat-bubble"><span className="chat-dot" /><span className="chat-dot" /><span className="chat-dot" /> <small>{t('heroChat')}</small></div>
      <svg className="hero-illustration" viewBox="0 0 560 470" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse cx="278" cy="421" rx="205" ry="22" fill="#C7DED2" opacity=".52"/>
        <path d="M109 203c0-84 68-153 153-153 87 0 157 67 157 153v126H109V203Z" fill="#E8F2ED"/>
        <circle cx="399" cy="112" r="29" fill="#FFF"/><path d="M399 98v28m-14-14h28" stroke="#79A38F" strokeWidth="4" strokeLinecap="round"/>
        <path d="M164 288c0-67 12-130 40-158 19-19 45-29 75-29 63 0 99 48 99 119v94H164v-26Z" fill="#B98B68"/>
        <path d="M196 207c0-54 29-87 74-87s74 33 74 87v64c0 47-31 77-74 77s-74-30-74-77v-64Z" fill="#F1C7A3"/>
        <path d="M190 211c1-65 36-108 88-108 40 0 69 25 80 66-27-4-48-20-64-43-17 24-52 41-101 46l-3 39Z" fill="#B98B68"/>
        <path d="M215 225c6-5 14-5 20 0m66 0c6-5 14-5 20 0" stroke="#694C3E" strokeWidth="3.6" strokeLinecap="round"/>
        <path d="M243 268c8 11 19 16 31 16s24-5 32-16" stroke="#B16E67" strokeWidth="4" strokeLinecap="round"/>
        <path d="M188 215c-12-7-24 0-24 15 0 13 8 22 21 22m164-37c13-7 24 0 24 15 0 13-8 22-21 22" fill="#F1C7A3"/>
        <path d="M184 350c19 18 45 28 79 28 35 0 62-10 81-28l24 22c12 11 18 27 18 44v17H139v-17c0-17 6-33 19-45l26-21Z" fill="#4F9078"/>
        <path d="M247 359h32l-16 27-16-27Z" fill="#FFFDF8"/>
        <rect x="356" y="305" width="133" height="99" rx="22" fill="#FFF" stroke="#DCE9E2" strokeWidth="2"/>
        <rect x="372" y="319" width="101" height="64" rx="14" fill="#EDF5F1"/>
        <circle cx="422" cy="343" r="12" fill="#E9B891"/><path d="M402 370c2-10 10-15 20-15s18 5 20 15" fill="#79A894"/><path d="M417 343c0-8 4-13 11-13 5 0 9 4 10 10-5-1-8-4-10-7-2 4-6 7-11 8Z" fill="#8F6B54"/>
        <path d="M395 392h55" stroke="#DFEAE4" strokeWidth="3" strokeLinecap="round"/><circle cx="422" cy="392" r="4" fill="#77A58F"/>
        <path d="M123 293c-15-16-12-38 5-48 16-9 34 1 37 18 2 13-5 23-15 31" fill="#FFF" stroke="#E4EDE8" strokeWidth="2"/>
        <path d="M139 270v12m-6-6h12" stroke="#79A38F" strokeWidth="2.3" strokeLinecap="round"/>
      </svg>
      <div className="visual-caption"><span className="caption-icon">♡</span><span><strong>{t('heroCaption')}</strong><small>{t('heroCaptionHint')}</small></span></div>
    </div>
  )
}

function LandingPage({ page = 'home' }) {
  const { t } = useLanguage()
  const isSignedIn = Boolean(getAuthToken())
  return (
    <>
      <header className="site-header">
        <nav className="nav-shell" aria-label={t('mainNavigation')}>
          <Brand href="/" />
          <div className="nav-links">
            <a className={`nav-link${page === 'home' ? ' nav-link--active' : ''}`} aria-current={page === 'home' ? 'page' : undefined} href="/">{t('home')}</a>
            <a className={`nav-link${page === 'about' ? ' nav-link--active' : ''}`} aria-current={page === 'about' ? 'page' : undefined} href="/about">{t('about')}</a>
            <a className={`nav-link${page === 'features' ? ' nav-link--active' : ''}`} aria-current={page === 'features' ? 'page' : undefined} href="/features">{t('features')}</a>
            <a className={`nav-link${page === 'contact' ? ' nav-link--active' : ''}`} aria-current={page === 'contact' ? 'page' : undefined} href="/contact">{t('contact')}</a>
          </div>
          <div className="nav-actions"><LanguageSelector /><a className="nav-login" href="/login">{t('login')}</a><a className="nav-register" href="/register">{t('createAccount')}</a><a className="nav-dashboard" href={isSignedIn ? '/dashboard' : '/login'}>{t('dashboard')}</a></div>
        </nav>
      </header>

      <main>
        {page === 'home' && <section className="hero-section" id="home">
          <div className="hero-shell">
            <div className="hero-copy">
              <div className="eyebrow"><span /> {t('heroEyebrow')}</div>
              <h1>{t('heroTitle')}<br /><span>{t('heroTitleAccent')}</span></h1>
              <p className="hero-description">{t('heroDescription')}</p>
              <div className="hero-buttons"><a className="button button--primary" href={isSignedIn ? '/dashboard' : '/login'}>{t('getStarted')} <span aria-hidden="true">→</span></a><a className="button button--secondary" href="/login">{t('login')}</a></div>
              <div className="hero-assurance"><span aria-hidden="true">✳</span> {t('heroAssurance')}</div>
            </div>
            <HeroArtwork />
          </div>
          <div className="hero-bottom-glow" aria-hidden="true" />
        </section>}

        {page === 'features' && <section className="features-section section-pad" id="features">
          <div className="content-shell">
            <div className="section-intro">
              <div className="eyebrow eyebrow--center"><span /> {t('featuresEyebrow')}</div>
              <h2>{t('featuresTitle')}<br /><span>{t('featuresTitleAccent')}</span></h2>
              <p>{t('featuresSubtitle')}</p>
            </div>
            <div className="feature-grid">
              {features.map((feature, index) => (
                <a className="feature-card" key={feature.titleKey} href={isSignedIn ? feature.href : '/login'} aria-label={t(isSignedIn ? 'featureOpenAria' : 'featureLoginAria').replace('{feature}', t(feature.titleKey))} style={{ '--card-index': index }}>
                  <div className={`feature-icon feature-icon--${feature.tint}`}><Icon name={feature.icon} /></div>
                  <h3>{t(feature.titleKey)}</h3>
                  <p>{t(feature.textKey)}</p>
                  <span className="feature-arrow" aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          </div>
        </section>}

        {page === 'about' && <section className="steps-section section-pad" id="how-it-works">
          <div className="content-shell">
            <div className="steps-heading">
              <div className="eyebrow"><span /> {t('stepsEyebrow')}</div>
              <h2>{t('stepsTitle')}<br /><span>{t('stepsTitleAccent')}</span></h2>
            </div>
            <div className="steps-grid">
              {steps.map((step) => (
                <article className="step-card" key={step.number}>
                  <div className="step-top"><span className="step-number">{step.number}</span><span className="step-icon-wrap"><Icon name={step.icon} /></span></div>
                  <h3>{t(step.titleKey)}</h3>
                  <p>{t(step.textKey)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>}

        {page === 'about' && <section className="about-section" id="about">
          <div className="about-orbit about-orbit--one" aria-hidden="true" /><div className="about-orbit about-orbit--two" aria-hidden="true" />
          <div className="about-shell">
            <div className="about-symbol" aria-hidden="true"><span>♡</span><i /><i /><i /></div>
            <div className="about-copy">
              <div className="eyebrow"><span /> {t('aboutEyebrow')}</div>
              <h2>{t('aboutTitle')} <span>{t('aboutTitleAccent')}</span></h2>
              <p>{t('aboutText')}</p>
              <p>{t('aboutTextSecondary')}</p>
              <a className="about-link" href="#how-it-works">{t('aboutLink')} <span aria-hidden="true">→</span></a>
            </div>
          </div>
        </section>}

        {page === 'home' && <section className="closing-section" aria-label={t('welcomeAria')}>
          <div className="closing-content"><span className="closing-heart" aria-hidden="true">♡</span><div><h2>{t('closingTitle')}</h2><p>{t('closingSubtitle')}</p></div><a className="button button--light" href="#home">{t('backToTop')} <span aria-hidden="true">↑</span></a></div>
        </section>}
      </main>

      {page === 'contact' && <section className="contact-section" id="contact">
        <div className="contact-content">
          <div className="eyebrow eyebrow--center"><span /> {t('contactEyebrow')}</div>
          <h2>{t('contactTitle')}</h2>
          <p>{t('contactDescription')}</p>
          <a className="button button--primary" href={isSignedIn ? '/contacts' : '/login'}>{isSignedIn ? t('openContacts') : t('loginToContinue')} <span aria-hidden="true">→</span></a>
        </div>
      </section>}

      <footer className="site-footer">
        <div className="footer-shell">
          <div className="footer-top">
            <div className="footer-brand"><Brand light href="/" /><p>{t('footerTagline')}</p></div>
            <div className="footer-nav"><span className="footer-label">{t('footerExplore')}</span><a href="/">{t('home')}</a><a href="/features">{t('features')}</a><a href="/about">{t('about')}</a></div>
            <div className="footer-nav"><span className="footer-label">ELDERCARE AI</span><a href="/about">{t('about')}</a><a href="/contact">{t('contact')}</a><a href="/login">{t('login')}</a></div>
            <div className="footer-note"><span aria-hidden="true">✳</span><p>{t('footerNote')}<br /><em>{t('footerNoteAccent')}</em></p></div>
          </div>
          <div className="footer-bottom"><span>{t('copyright')}</span><span>{t('madeWithCare')} <b aria-hidden="true">♥</b></span></div>
        </div>
      </footer>
    </>
  )
}

function App() {
  const { t } = useLanguage()
  const [pathname, setPathname] = useState(window.location.pathname)
  const route = resolveAppRoute(pathname)
  const [backendHealth, setBackendHealth] = useState({ api: 'checking', database: 'unknown' })
  const [currentUser, setCurrentUser] = useState(null)
  const protectedPage = route.kind === 'protected'
  const [dashboardState, setDashboardState] = useState(protectedPage ? 'checking' : 'ready')

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((path) => {
    const destination = new URL(path, window.location.href)
    if (destination.origin !== window.location.origin) return
    if (destination.href === window.location.href) return
    window.history.pushState({}, '', `${destination.pathname}${destination.search}${destination.hash}`)
    setPathname(destination.pathname)
    window.scrollTo(0, 0)
    if (destination.hash) requestAnimationFrame(() => document.getElementById(decodeURIComponent(destination.hash.slice(1)))?.scrollIntoView())
  }, [])

  useEffect(() => {
    const onInternalLink = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target.closest?.('a[href]')
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return
      const destination = new URL(anchor.href, window.location.href)
      if (destination.origin !== window.location.origin) return
      if (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.hash) return
      event.preventDefault()
      navigate(`${destination.pathname}${destination.search}${destination.hash}`)
    }
    document.addEventListener('click', onInternalLink)
    return () => document.removeEventListener('click', onInternalLink)
  }, [navigate])

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined

    let isMounted = true
    getBackendHealth()
      .then((health) => {
        if (isMounted) setBackendHealth(health)
      })
      .catch(() => {
        if (isMounted) setBackendHealth({ api: 'unavailable', database: 'unknown' })
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (route.kind === 'redirect') {
      window.location.replace(route.to)
      return undefined
    }
    const hasSession = Boolean(getAuthToken())
    if (!protectedPage && !hasSession) return undefined
    if (protectedPage && !hasSession) {
      window.location.replace('/login')
      return undefined
    }
    let isMounted = true
    getCurrentUser()
      .then(({ user }) => {
        if (isMounted) { setCurrentUser(user); setDashboardState('ready') }
      })
      .catch(() => {
        clearAuthToken()
        if (protectedPage) window.location.replace('/login')
      })
    return () => { isMounted = false }
  }, [protectedPage, route.kind, route.to])

  const page = route.kind === 'login'
    ? <AuthPage mode="login" />
    : route.kind === 'register'
      ? <AuthPage mode="register" />
      : protectedPage
        ? dashboardState === 'ready' && currentUser
          ? <Dashboard user={currentUser} page={route.page} onNavigate={navigate} onLogout={() => { clearAuthToken(); setCurrentUser(null); navigate('/') }} />
          : <main className="dashboard-loading" role="status">{t('sessionChecking')}</main>
      : <LandingPage page={route.kind === 'public' ? route.page : 'home'} />

  const appContent = <>{currentUser && <ReminderScheduler userId={currentUser.id} />}{page}</>

  if (!import.meta.env.DEV) return appContent

  const statusText = backendHealth.api === 'checking'
    ? t('backendChecking')
    : backendHealth.api === 'unavailable'
      ? t('backendUnavailable')
      : t('backendOnline').replace('{status}', backendHealth.database)

  return (
    <>
      <div className={`backend-status backend-status--${backendHealth.api}`} role="status" aria-live="polite">
        <span className="backend-status-dot" aria-hidden="true" />
        {statusText}
      </div>
      {appContent}
    </>
  )
}

export default App
