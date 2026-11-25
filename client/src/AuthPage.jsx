import { useState } from 'react'
import { loginUser, registerUser, saveAuthToken } from './api.js'
import { LanguageSelector, useLanguage } from './i18n.jsx'
import './AuthPage.css'

function AuthBrand() {
  const { t } = useLanguage()
  return (
    <a className="auth-brand" href="/" aria-label={t('brandHomeAria')}>
      <span className="auth-brand-mark" aria-hidden="true">
        <svg viewBox="0 0 42 42" fill="none"><rect width="42" height="42" rx="15" fill="currentColor"/><path d="M21 30s-10-6-10-12.3a5.5 5.5 0 0 1 10-3.1 5.5 5.5 0 0 1 10 3.1C31 24 21 30 21 30Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/><path d="M14 20.5h4l2-3 3.2 6 2-3H28" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </span>
      <span>ElderCare <b>AI</b></span>
    </a>
  )
}

function Field({ id, label, type = 'text', value, onChange, error, placeholder, autoComplete, inputMode }) {
  const errorId = `${id}-error`
  return (
    <div className={`auth-field${error ? ' auth-field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        required
      />
      {error && <p className="field-error" id={errorId}>{error}</p>}
    </div>
  )
}

function PasswordField({ id, label, value, onChange, error, visible, onToggle, autoComplete }) {
  const { t } = useLanguage()
  const errorId = `${id}-error`
  return (
    <div className={`auth-field${error ? ' auth-field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="password-wrap">
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={t('enterPassword')}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          required
        />
        <button className="password-toggle" type="button" onClick={onToggle} aria-label={`${t(visible ? 'hidePassword' : 'showPassword')} ${label.toLowerCase()}`}>
          {visible ? t('hidePassword') : t('showPassword')}
        </button>
      </div>
      {error && <p className="field-error" id={errorId}>{error}</p>}
    </div>
  )
}

function AuthAside({ mode }) {
  const { t } = useLanguage()
  return (
    <aside className="auth-aside">
      <div className="aside-orbit aside-orbit--one" /><div className="aside-orbit aside-orbit--two" />
      <div className="aside-top"><AuthBrand /><span className="aside-pill"><i /> {t('authAsidePill')}</span></div>
      <div className="aside-message">
        <div className="aside-heart" aria-hidden="true">♡</div>
        <p className="aside-kicker">{t('authAsideEyebrow')}</p>
        <h2>{mode === 'login' ? t('authLoginAsideTitle') : t('authRegisterAsideTitle')}</h2>
        <p className="aside-description">{t('authAsideDescription')}</p>
      </div>
      <div className="aside-bottom"><span aria-hidden="true">✳</span> {t('authAsideFooter')}</div>
    </aside>
  )
}

function LoginForm() {
  const { t } = useLanguage()
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [forgotNotice, setForgotNotice] = useState(false)

  const update = (field) => (event) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }))
    setErrors((previous) => ({ ...previous, [field]: '' }))
    setNotice('')
    setNoticeType('')
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!values.email.trim()) nextErrors.email = t('enterEmail')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) nextErrors.email = t('validEmail')
    if (!values.password) nextErrors.password = t('enterPassword')
    setErrors(nextErrors)
    setNotice('')
    setNoticeType('')
    if (Object.keys(nextErrors).length) {
      document.getElementById(Object.keys(nextErrors)[0])?.focus()
      return
    }
    setIsSubmitting(true)
    try {
      const result = await loginUser({ email: values.email.trim(), password: values.password })
      saveAuthToken(result.token, remember)
      window.location.assign('/dashboard')
    } catch {
      setNotice(t('loginError'))
      setNoticeType('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="auth-heading"><span className="auth-eyebrow">{t('loginEyebrow')}</span><h1 id="auth-title">{t('loginTitle')}</h1><p>{t('loginSubtitle')}</p></div>
      <form className="auth-form" onSubmit={submit} noValidate>
        <Field id="email" label={t('email')} type="email" value={values.email} onChange={update('email')} error={errors.email} placeholder="you@example.com" autoComplete="email" inputMode="email" />
        <PasswordField id="password" label={t('password')} value={values.password} onChange={update('password')} error={errors.password} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="current-password" />
        <div className="login-options">
          <label className="check-label"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span className="custom-check" />{t('remember')}</label>
          <button className="text-button" type="button" onClick={() => setForgotNotice((value) => !value)}>{t('forgot')}</button>
        </div>
        {forgotNotice && <p className="auth-inline-note" role="status">{t('forgotHelp')}</p>}
        <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? t('signingIn') : t('login')} <span aria-hidden="true">&rarr;</span></button>
        {notice && <p className={`auth-notice auth-notice--${noticeType}`} role="alert">{notice}</p>}
      </form>
      <p className="auth-switch">{t('newToElderCare')} <a href="/register">{t('createAccount')}</a></p>
    </>
  )
}

function RegistrationForm() {
  const { t } = useLanguage()
  const [values, setValues] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '', consent: false })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const update = (field) => (event) => {
    const value = field === 'consent' ? event.target.checked : event.target.value
    setValues((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: '' }))
    setNotice('')
    setNoticeType('')
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (values.name.trim().length < 2) nextErrors.name = t('enterName')
    if (!values.email.trim()) nextErrors.email = t('enterEmail')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) nextErrors.email = t('validEmail')
    const digits = values.phone.replace(/\D/g, '')
    if (!values.phone.trim()) nextErrors.phone = t('enterPhone')
    else if (digits.length < 7 || digits.length > 15) nextErrors.phone = t('validPhone')
    if (values.password.length < 8) nextErrors.password = t('passwordLength')
    if (!values.confirmPassword) nextErrors.confirmPassword = t('confirmPassword')
    else if (values.password !== values.confirmPassword) nextErrors.confirmPassword = t('passwordMismatch')
    if (!values.consent) nextErrors.consent = t('consentRequired')
    setErrors(nextErrors)
    setNotice('')
    setNoticeType('')
    if (Object.keys(nextErrors).length) {
      document.getElementById(Object.keys(nextErrors)[0])?.focus()
      return
    }
    setIsSubmitting(true)
    let accountCreated = false
    try {
      await registerUser({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      })
      accountCreated = true
      const session = await loginUser({ email: values.email.trim(), password: values.password })
      saveAuthToken(session.token)
      window.location.assign('/dashboard')
    } catch (error) {
      setNotice(accountCreated ? t('accountCreatedLoginError') : error.status === 409 ? t('duplicateEmail') : t('registrationError'))
      setNoticeType(accountCreated ? 'success' : 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="auth-heading"><span className="auth-eyebrow">{t('registerEyebrow')}</span><h1 id="auth-title">{t('registerTitle')}</h1><p>{t('registerSubtitle')}</p></div>
      <form className="auth-form auth-form--register" onSubmit={submit} noValidate>
        <Field id="name" label={t('fullName')} value={values.name} onChange={update('name')} error={errors.name} placeholder={t('yourFullName')} autoComplete="name" />
        <div className="form-row">
          <Field id="email" label={t('email')} type="email" value={values.email} onChange={update('email')} error={errors.email} placeholder="you@example.com" autoComplete="email" inputMode="email" />
          <Field id="phone" label={t('phoneNumber')} type="tel" value={values.phone} onChange={update('phone')} error={errors.phone} placeholder={t('phonePlaceholder')} autoComplete="tel" inputMode="tel" />
        </div>
        <div className="form-row">
          <PasswordField id="password" label={t('password')} value={values.password} onChange={update('password')} error={errors.password} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="new-password" />
          <PasswordField id="confirmPassword" label={t('confirmPassword')} value={values.confirmPassword} onChange={update('confirmPassword')} error={errors.confirmPassword} visible={showConfirm} onToggle={() => setShowConfirm((value) => !value)} autoComplete="new-password" />
        </div>
        <div className={`consent-wrap${errors.consent ? ' consent-wrap--error' : ''}`}>
          <label className="check-label consent-label"><input id="consent" type="checkbox" checked={values.consent} onChange={update('consent')} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? 'consent-error' : undefined} /><span className="custom-check" /><span>{t('agreeTo')} <strong>{t('terms')}</strong> {t('and')} <strong>{t('privacyPolicy')}</strong>.</span></label>
          {errors.consent && <p className="field-error" id="consent-error">{errors.consent}</p>}
        </div>
        <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? t('creatingAccount') : t('createAccount')} <span aria-hidden="true">&rarr;</span></button>
        {notice && <p className={`auth-notice auth-notice--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>{notice}</p>}
      </form>
      <p className="auth-switch">{t('alreadyAccount')} <a href="/login">{t('login')}</a></p>
    </>
  )
}

export default function AuthPage({ mode }) {
  const { t } = useLanguage()
  const isLogin = mode === 'login'
  return (
    <main className={`auth-page${isLogin ? ' auth-page--login' : ' auth-page--register'}`}>
      <LanguageSelector className="language-select--auth" />
      <AuthAside mode={mode} />
      <section className="auth-main" aria-labelledby="auth-title">
        <div className="auth-mobile-brand"><AuthBrand /></div>
        <div className="auth-card">
          {isLogin ? <LoginForm /> : <RegistrationForm />}
        </div>
        <p className="auth-privacy-note"><span aria-hidden="true">♡</span> {t('privacyPromise')}</p>
      </section>
    </main>
  )
}
