const persianDigits = value => String(value).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])
const persianDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
})
const persianDayFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-arabext', {
  timeZone: 'UTC', day: 'numeric',
})
const persianMonthFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-arabext', {
  timeZone: 'UTC', month: 'long', year: 'numeric',
})
const monthIdentityFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  timeZone: 'UTC', month: 'numeric', year: 'numeric',
})
const jalaliMonthNames = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']

export function parseGregorianDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) return null
  const [, year, month, day] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12))
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === Number(month) - 1
    && date.getUTCDate() === Number(day) ? date : null
}

export function gregorianDateKey(date) {
  const year = String(date.getUTCFullYear()).padStart(4, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayInTehran() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function formatPersianJalaliDate(value) {
  const date = parseGregorianDateKey(value)
  if (!date) return ''
  const parts = Object.fromEntries(persianDateFormatter.formatToParts(date).map(part => [part.type, part.value]))
  return `${persianDigits(parts.year)}/${persianDigits(parts.month.padStart(2, '0'))}/${persianDigits(parts.day.padStart(2, '0'))}`
}

function monthIdentity(date) {
  return monthIdentityFormatter.format(date)
}

export function jalaliYearAndMonth(value) {
  const date = parseGregorianDateKey(value)
  if (!date) return null
  const parts = Object.fromEntries(monthIdentityFormatter.formatToParts(date).map(part => [part.type, part.value]))
  return {year: Number(parts.year), month: Number(parts.month)}
}

/** Return Gregorian start keys for each month of a Jalali year using Intl's Persian calendar. */
export function jalaliMonthsInYear(year) {
  const firstGregorian = new Date(Date.UTC(Number(year) + 621, 0, 1, 12))
  const result = new Map()
  for (let offset = 0; offset < 460 && result.size < 12; offset++) {
    const date = new Date(firstGregorian)
    date.setUTCDate(date.getUTCDate() + offset)
    const parts = Object.fromEntries(monthIdentityFormatter.formatToParts(date).map(part => [part.type, part.value]))
    if (Number(parts.year) === Number(year)) {
      const month = Number(parts.month)
      if (!result.has(month)) result.set(month, gregorianDateKey(date))
    }
  }
  return Array.from(result, ([month, start]) => ({month, name: jalaliMonthNames[month - 1] || String(month), start})).sort((a, b) => a.month - b.month)
}

export function jalaliMonthTitle(value) {
  const date = parseGregorianDateKey(value)
  if (!date) return ''
  const parts = Object.fromEntries(persianMonthFormatter.formatToParts(date).map(part => [part.type, part.value]))
  return `${parts.month} ${parts.year}`
}

/** @param {string} value @param {{min?: string, max?: string, disabledDates?: string[]}} options */
export function jalaliMonthCells(value, {min = '', max = '', disabledDates = []} = {}) {
  const cursor = parseGregorianDateKey(value) || parseGregorianDateKey(todayInTehran())
  const identity = monthIdentity(cursor)
  const first = new Date(cursor)
  for (let count = 0; count < 32; count++) {
    const previous = new Date(first)
    previous.setUTCDate(first.getUTCDate() - 1)
    if (monthIdentity(previous) !== identity) break
    first.setTime(previous.getTime())
  }
  const saturdayOffset = (first.getUTCDay() + 1) % 7
  first.setUTCDate(first.getUTCDate() - saturdayOffset)
  const disabled = new Set(disabledDates)
  return Array.from({length: 42}, (_, index) => {
    const date = new Date(first)
    date.setUTCDate(first.getUTCDate() + index)
    const key = gregorianDateKey(date)
    return {
      key,
      label: persianDayFormatter.format(date),
      inMonth: monthIdentity(date) === identity,
      disabled: monthIdentity(date) !== identity || (min && key < min) || (max && key > max) || disabled.has(key),
    }
  })
}

export function shiftJalaliMonth(value, direction) {
  const date = parseGregorianDateKey(value) || parseGregorianDateKey(todayInTehran())
  const first = new Date(date)
  for (let count = 0; count < 32; count++) {
    const previous = new Date(first)
    previous.setUTCDate(first.getUTCDate() - 1)
    if (monthIdentity(previous) !== monthIdentity(date)) break
    first.setTime(previous.getTime())
  }
  first.setUTCDate(first.getUTCDate() + (direction < 0 ? -1 : 36))
  return gregorianDateKey(first)
}

export function addGregorianDays(value, days) {
  const date = parseGregorianDateKey(value)
  if (!date) return ''
  date.setUTCDate(date.getUTCDate() + days)
  return gregorianDateKey(date)
}

export function addGregorianMonths(value, months) {
  const date = parseGregorianDateKey(value)
  if (!date) return ''
  const desiredDay = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(desiredDay, lastDay))
  return gregorianDateKey(date)
}
