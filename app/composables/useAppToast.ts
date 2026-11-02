import {isDuplicateToast} from '~/composables/toastUtils.mjs'
export type ToastKind='success'|'error'|'warning'|'info'
export type ToastItem={id:number;kind:ToastKind;message:string;duration:number;createdAt:number}
let nextToastId=1
const timeouts=new Map<number,ReturnType<typeof setTimeout>>()
export const useAppToast=()=>{
 const items=useState<ToastItem[]>('app-toast-items',()=>[])
 const recent=useState<{kind:ToastKind;message:string;at:number}[]>('app-toast-recent',()=>[])
 function dismiss(id:number){items.value=items.value.filter(item=>item.id!==id);const timer=timeouts.get(id);if(timer)clearTimeout(timer);timeouts.delete(id)}
 function push(kind:ToastKind,message:string,duration=kind==='success'?3000:kind==='info'?4000:kind==='warning'?5000:6000){
  const clean=message.trim();if(!clean)return
  const now=Date.now();recent.value=recent.value.filter(item=>now-item.at<8000)
  if(recent.value.some(item=>isDuplicateToast(item,kind,clean,now)))return
  recent.value.push({kind,message:clean,at:now})
  const item={id:nextToastId++,kind,message:clean,duration,createdAt:now}
  items.value=[...items.value.slice(-2),item]
  if(import.meta.client)timeouts.set(item.id,setTimeout(()=>dismiss(item.id),duration))
 }
 return{items,dismiss,success:(message:string,duration?:number)=>push('success',message,duration),error:(message:string,duration?:number)=>push('error',message,duration),warning:(message:string,duration?:number)=>push('warning',message,duration),info:(message:string,duration?:number)=>push('info',message,duration)}
}
