const SCRIPT_PREFIX = 'https://www.google.com/recaptcha/api.js?render='
let pendingScript = null
let pendingSiteKey = null
let loadedSiteKey = null

const captchaUnavailable = () => new Error('CAPTCHA_UNAVAILABLE')

function withTimeout(promise, timeoutMs, win) {
  return new Promise((resolve, reject) => {
    const timer = win.setTimeout(() => reject(captchaUnavailable()), timeoutMs)
    Promise.resolve(promise).then(
      value => { win.clearTimeout(timer); resolve(value) },
      () => { win.clearTimeout(timer); reject(captchaUnavailable()) },
    )
  })
}

export function loadRecaptchaV3(siteKey, { win = window, doc = document, timeoutMs = 12000 } = {}) {
  const current = win.grecaptcha
  if (current) {
    if (loadedSiteKey && loadedSiteKey !== siteKey) return Promise.reject(captchaUnavailable())
    return Promise.resolve()
  }
  if (pendingScript) {
    return pendingSiteKey === siteKey ? pendingScript : Promise.reject(captchaUnavailable())
  }

  // A marked script without grecaptcha means an earlier request failed or timed
  // out. A completed load event cannot be observed retroactively, so discard it.
  const stale = doc.querySelector('script[data-recaptcha-v3="true"]')
  if (stale) stale.remove()

  pendingSiteKey = siteKey
  pendingScript = new Promise((resolve, reject) => {
    const script = doc.createElement('script')
    let settled = false
    const timer = win.setTimeout(() => finish(captchaUnavailable()), timeoutMs)
    function cleanup() {
      win.clearTimeout(timer)
      script.removeEventListener('load', loaded)
      script.removeEventListener('error', failed)
    }
    function finish(error) {
      if (settled) return
      settled = true
      cleanup()
      if (error) {
        script.remove()
        pendingScript = null
        pendingSiteKey = null
        reject(error)
        return
      }
      loadedSiteKey = siteKey
      resolve()
    }
    function loaded() {
      if (!win.grecaptcha) finish(captchaUnavailable())
      else finish()
    }
    function failed() { finish(captchaUnavailable()) }

    script.dataset.recaptchaV3 = 'true'
    script.dataset.siteKey = siteKey
    script.async = true
    script.defer = true
    script.addEventListener('load', loaded, { once: true })
    script.addEventListener('error', failed, { once: true })
    script.src = `${SCRIPT_PREFIX}${encodeURIComponent(siteKey)}`
    doc.head.appendChild(script)
  }).finally(() => {
    if (!loadedSiteKey) {
      pendingScript = null
      pendingSiteKey = null
    }
  })
  return pendingScript
}

export async function executeRecaptchaV3(siteKey, action, { win = window, doc = document, timeoutMs = 12000 } = {}) {
  await loadRecaptchaV3(siteKey, { win, doc, timeoutMs })
  const recaptcha = win.grecaptcha
  if (!recaptcha) throw captchaUnavailable()

  await withTimeout(new Promise((resolve, reject) => {
    try { recaptcha.ready(resolve) } catch { reject(captchaUnavailable()) }
  }), timeoutMs, win)

  let token
  try { token = await withTimeout(recaptcha.execute(siteKey, { action }), timeoutMs, win) }
  catch { throw captchaUnavailable() }
  if (typeof token !== 'string' || !token.trim()) throw captchaUnavailable()
  return token
}

// Keep the protected HTTP operation structurally after token resolution. A
// failed/empty token can never reach the callback that sends the OTP request.
export async function submitAfterRecaptcha(getToken, submit, action) {
  const token = await getToken(action)
  if (typeof token !== 'string' || !token.trim()) throw captchaUnavailable()
  return submit(token)
}
