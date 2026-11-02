<script setup lang="ts">
import {formatPersianJalaliDate, todayInTehran} from '~/utils/jalaliDate.mjs'
type Cell = {key: string; label: string; inMonth: boolean; disabled: boolean}
type JalaliMonth = {month: number; name: string; start: string; disabled: boolean}
defineProps<{
  pickerId: string
  title: string
  weekdays: string[]
  rows: Cell[][]
  selected: string
  focusKey: string
  monthPickerOpen: boolean
  year: number
  month: number
  years: number[]
  months: JalaliMonth[]
}>()
const emit = defineEmits<{
  previous: []
  next: []
  toggleMonthYear: []
  selectYear: [year: number]
  selectMonth: [month: number]
  select: [key: string]
  keydownDay: [event: KeyboardEvent, key: string]
}>()
const today = todayInTehran()

function onYearChange(event: Event) {
  const year = Number((event.target as HTMLSelectElement).value)
  if (Number.isInteger(year)) emit('selectYear', year)
}

function onMonthChange(event: Event) {
  const month = Number((event.target as HTMLSelectElement).value)
  if (Number.isInteger(month)) emit('selectMonth', month)
}

const persianYearFormatter = new Intl.NumberFormat('fa-IR', {useGrouping: false})
</script>

<template>
  <div class="jalali-calendar-panel">
    <div class="jalali-calendar-heading">
      <button type="button" aria-label="ماه پیش" @click="emit('previous')">‹</button>
      <button class="jalali-calendar-title" type="button" :aria-expanded="monthPickerOpen" @click="emit('toggleMonthYear')">{{ title }}</button>
      <button type="button" aria-label="ماه بعد" @click="emit('next')">›</button>
    </div>
    <fieldset v-if="monthPickerOpen" class="jalali-month-year-picker">
      <legend class="sr-only">انتخاب ماه و سال</legend>
      <label>سال<select :value="year" @change="onYearChange"><option v-for="item in years" :key="item" :value="item">{{ persianYearFormatter.format(item) }}</option></select></label>
      <label>ماه<select :value="month" @change="onMonthChange"><option v-for="item in months" :key="item.month" :value="item.month" :disabled="item.disabled">{{ item.name }}</option></select></label>
      <button type="button" class="jalali-month-year-back" @click="emit('toggleMonthYear')">بازگشت به تقویم</button>
    </fieldset>
    <div v-else class="jalali-calendar-grid" role="grid" :aria-label="title">
      <div class="jalali-calendar-weekdays" role="row">
        <span v-for="(day, index) in weekdays" :key="day" role="columnheader" :aria-label="day" :title="day">{{ ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'][index] }}</span>
      </div>
      <div v-for="(week, index) in rows" :key="index" class="jalali-calendar-week" role="row">
        <button
          v-for="cell in week" :key="cell.key" :data-date-key="cell.key"
          type="button" role="gridcell" :disabled="cell.disabled"
          :class="{ 'is-outside': !cell.inMonth, 'is-unavailable': cell.disabled && cell.inMonth, 'is-selected': selected === cell.key, 'is-today': today === cell.key }"
          :aria-label="formatPersianJalaliDate(cell.key)" :aria-selected="selected === cell.key"
          :aria-current="today === cell.key ? 'date' : undefined"
          :tabindex="focusKey === cell.key ? 0 : -1"
          @click="emit('select', cell.key)"
          @keydown="emit('keydownDay', $event, cell.key)"
        >{{ cell.label }}</button>
      </div>
    </div>
  </div>
</template>
