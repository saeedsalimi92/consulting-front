<script setup lang="ts">
const props=defineProps<{name:string; icon?:string|null}>()
const normalize=(value:string)=>value.toLocaleLowerCase('fa-IR')
const iconKey=computed(()=>{
 const text=normalize(`${props.name} ${props.icon||''}`)
 if(/couple|marriage|ازدواج|زوج|همسر/.test(text))return 'couples'
 if(/family|خانواد/.test(text))return 'family'
 if(/child|adolescent|کودک|نوجوان/.test(text))return 'child'
 if(/education|school|تحصیل|آموزش/.test(text))return 'education'
 if(/online|virtual|آنلاین|مجازی/.test(text))return 'online'
 if(/individual|فردی|شخصی/.test(text))return 'individual'
 return 'general'
})
const paths:Record<string,string[]>={
 couples:['M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z','M8.5 11.5h.01','M15.5 11.5h.01'],
 family:['M3 11 12 4l9 7','M5.5 10v10h13V10','M9 20v-5h6v5'],
 child:['M12 3v3','M12 18v3','m4.2 4.2 2.1 2.1','m17.7 17.7 2.1 2.1','M3 12h3','M18 12h3','m4.2 19.8 2.1-2.1','m17.7 6.3 2.1-2.1','M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z'],
 education:['M4 5h16v14H4z','M8 9h8','M8 12h8','M8 15h5'],
 online:['M3 12a9 9 0 0 1 18 0','M3 12a9 9 0 0 0 18 0','M3 12h18','M12 3a14 14 0 0 1 0 18','M12 3a14 14 0 0 0 0 18'],
 individual:['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z','M4.5 21a7.5 7.5 0 0 1 15 0'],
 general:['M12 3v18','M3 12h18','M5.6 5.6l12.8 12.8','m18.4 5.6-12.8 12.8']
}
const iconPaths=computed(()=>paths[iconKey.value]||paths.general)
</script>
<template><span class="specialty-symbol" :class="`is-${iconKey}`" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path v-for="(path,index) in iconPaths" :key="index" :d="path"/></svg></span></template>
