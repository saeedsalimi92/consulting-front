<script setup lang="ts">
import {
  addGregorianDays,
  formatPersianJalaliDate,
  jalaliMonthCells,
  jalaliMonthsInYear,
  jalaliMonthTitle,
  jalaliYearAndMonth,
  todayInTehran,
} from '~/utils/jalaliDate.mjs'

const props = withDefaults(defineProps<{
  modelValue: string
  label?: string
  min?: string
  max?: string
  disabledDates?: string[]
  inline?: boolean
  disabled?: boolean
}>(), {label: 'انتخاب تاریخ', min: '', max: '', disabledDates: () => [], inline: false, disabled: false})
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const uid = useId()
const pickerId = `jalali-picker-${uid}`
const dialog = ref<HTMLDialogElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const inlineRoot = ref<HTMLElement | null>(null)
const cursor = ref(props.modelValue || props.min || todayInTehran())
const focusKey = ref(props.modelValue || props.min || todayInTehran())
const initialJalaliDate = jalaliYearAndMonth(cursor.value) || jalaliYearAndMonth(todayInTehran())!
const monthPickerOpen = ref(false)
const viewYear = ref(initialJalaliDate.year)
const viewMonth = ref(initialJalaliDate.month)
const weekdays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
const cells = computed(() => jalaliMonthCells(cursor.value, {
  min: props.min,
  max: props.max,
  disabledDates: props.disabledDates as string[],
}).map(cell => props.disabled ? {...cell, disabled: true} : cell))
const title = computed(() => jalaliMonthTitle(cursor.value))
const rows = computed(() => Array.from({length: 6}, (_, row) => cells.value.slice(row * 7, row * 7 + 7)))
const selectedText = computed(() => formatPersianJalaliDate(props.modelValue))
const todayYear = jalaliYearAndMonth(todayInTehran())!.year
const yearOptions = computed(() => {
  const minYear = props.min ? jalaliYearAndMonth(props.min)?.year ?? todayYear - 150 : todayYear - 150
  const maxYear = props.max ? jalaliYearAndMonth(props.max)?.year ?? todayYear + 5 : todayYear + 5
  return Array.from({length: Math.max(0, maxYear - minYear + 1)}, (_, index) => maxYear - index)
})
const monthOptions = computed(() => {
  const months = jalaliMonthsInYear(viewYear.value)
  return months.map((item, index) => {
    const nextStart = months[index + 1]?.start || jalaliMonthsInYear(viewYear.value + 1)[0]?.start || item.start
    const monthEnd = addGregorianDays(nextStart, -1)
    return {
      ...item,
      disabled: Boolean((props.min && monthEnd < props.min) || (props.max && item.start > props.max)),
    }
  })
})

watch(() => props.modelValue, value => {
  if (value) {
    cursor.value = value
    focusKey.value = value
    const parts = jalaliYearAndMonth(value)
    if (parts) { viewYear.value = parts.year; viewMonth.value = parts.month }
  }
})

function enabledDate(key: string) {
  return cells.value.some(cell => cell.key === key && !cell.disabled)
}

function focusDate(key: string) {
  focusKey.value = key
  if (!cells.value.some(cell => cell.key === key && cell.inMonth)) cursor.value = key
  nextTick(() => {
    const root = props.inline ? inlineRoot.value : dialog.value
    root?.querySelector<HTMLButtonElement>(`[data-date-key="${key}"]`)?.focus()
  })
}

function monthStart(value: string) {
  const monthTitle = jalaliMonthTitle(value)
  let current = value
  for (let count = 0; count < 32; count++) {
    const previous = addGregorianDays(current, -1)
    if (jalaliMonthTitle(previous) !== monthTitle) break
    current = previous
  }
  return current
}

function shiftMonth(direction: number) {
  monthPickerOpen.value = false
  const first = monthStart(cursor.value)
  cursor.value = addGregorianDays(first, direction < 0 ? -1 : 36)
  focusKey.value = cursor.value
}

function toggleMonthYearPicker() {
  if (!monthPickerOpen.value) {
    const parts = jalaliYearAndMonth(cursor.value)
    if (parts) { viewYear.value = parts.year; viewMonth.value = parts.month }
  }
  monthPickerOpen.value = !monthPickerOpen.value
}

function selectYear(year: number) {
  viewYear.value = year
  const selectedMonth = monthOptions.value.find(item => item.month === viewMonth.value && !item.disabled)
    || monthOptions.value.find(item => !item.disabled)
  if (selectedMonth) viewMonth.value = selectedMonth.month
}

function selectMonth(month: number) {
  const selected = monthOptions.value.find(item => item.month === month && !item.disabled)
  if (!selected) return
  viewMonth.value = selected.month
  cursor.value = selected.start
  monthPickerOpen.value = false
  const firstEnabled = cells.value.find(cell => cell.inMonth && !cell.disabled)
  if (firstEnabled) focusDate(firstEnabled.key)
}

function selectDate(key: string) {
  if (!enabledDate(key)) return
  monthPickerOpen.value = false
  emit('update:modelValue', key)
  if (!props.inline) {
    dialog.value?.close()
    nextTick(() => trigger.value?.focus())
  }
}

function onDayKeydown(event: KeyboardEvent, key: string) {
  let next = ''
  const date = new Date(`${key}T12:00:00Z`)
  const weekdayOffset = (date.getUTCDay() + 1) % 7
  if (event.key === 'ArrowLeft') next = addGregorianDays(key, 1)
  else if (event.key === 'ArrowRight') next = addGregorianDays(key, -1)
  else if (event.key === 'ArrowUp') next = addGregorianDays(key, -7)
  else if (event.key === 'ArrowDown') next = addGregorianDays(key, 7)
  else if (event.key === 'Home') next = addGregorianDays(key, -weekdayOffset)
  else if (event.key === 'End') next = addGregorianDays(key, 6 - weekdayOffset)
  else if (event.key === 'PageUp') { event.preventDefault(); shiftMonth(-1); return }
  else if (event.key === 'PageDown') { event.preventDefault(); shiftMonth(1); return }
  if (!next) return
  event.preventDefault()
  if (!enabledDate(next)) {
    cursor.value = next
    nextTick(() => {
      const firstEnabled = cells.value.find(cell => !cell.disabled)
      if (firstEnabled) focusDate(firstEnabled.key)
    })
    return
  }
  focusDate(next)
}

async function openDialog() {
  monthPickerOpen.value = false
  cursor.value = props.modelValue || props.min || todayInTehran()
  focusKey.value = props.modelValue || ''
  await nextTick()
  if (dialog.value && !dialog.value.open) dialog.value.showModal()
  await nextTick()
  const initial = cells.value.find(cell => cell.key === (props.modelValue || focusKey.value) && !cell.disabled)
    || cells.value.find(cell => !cell.disabled)
  if (initial) focusDate(initial.key)
}

function closeDialog() {
  monthPickerOpen.value = false
  dialog.value?.close()
  nextTick(() => trigger.value?.focus())
}
</script>

<template>
  <div class="jalali-date-picker" :class="{'is-inline': inline}">
    <button
      v-if="!inline" :id="pickerId" ref="trigger" class="jalali-date-trigger form-control"
      type="button" :disabled="disabled" :aria-label="label + ': ' + (selectedText || 'انتخاب تاریخ')"
      aria-haspopup="dialog" :aria-controls="pickerId + '-dialog'" @click="openDialog"
    >
      <span>{{ selectedText || 'انتخاب تاریخ' }}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17"/></svg>
    </button>
    <section v-if="inline" ref="inlineRoot" class="jalali-calendar-shell" :aria-label="label">
      <JalaliCalendarPanel
        :picker-id="pickerId" :title="title" :weekdays="weekdays" :rows="rows"
        :selected="modelValue" :focus-key="focusKey"
        :month-picker-open="monthPickerOpen" :year="viewYear" :month="viewMonth"
        :years="yearOptions" :months="monthOptions"
        @toggle-month-year="toggleMonthYearPicker" @select-year="selectYear" @select-month="selectMonth"
        @previous="shiftMonth(-1)" @next="shiftMonth(1)"
        @select="selectDate" @keydown-day="onDayKeydown"
      />
    </section>
    <Teleport v-if="!inline" to="body">
      <dialog
        :id="pickerId + '-dialog'" ref="dialog" class="jalali-picker-dialog"
        :aria-label="label" @click.self="closeDialog" @cancel.prevent="closeDialog"
      >
        <div class="jalali-calendar-shell">
          <JalaliCalendarPanel
            :picker-id="pickerId" :title="title" :weekdays="weekdays" :rows="rows"
            :selected="modelValue" :focus-key="focusKey"
            :month-picker-open="monthPickerOpen" :year="viewYear" :month="viewMonth"
            :years="yearOptions" :months="monthOptions"
            @toggle-month-year="toggleMonthYearPicker" @select-year="selectYear" @select-month="selectMonth"
            @previous="shiftMonth(-1)" @next="shiftMonth(1)"
            @select="selectDate" @keydown-day="onDayKeydown"
          />
        </div>
        <button class="jalali-calendar-done" type="button" @click="closeDialog">تأیید</button>
      </dialog>
    </Teleport>
  </div>
</template>
