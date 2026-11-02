import type {ApiCollection,ApiItem,Counselor,Specialty,Comment} from '~/types/api'
import {normalizeAppError,shouldAutoToast} from '~/composables/toastUtils.mjs'
export type CmsEntry={id:number;type:string;title:string;slug:string;body:string|null;image:string|null;extra:Record<string,any>|null;created_at?:string}
export const useBackend=()=>{
 const config=useRuntimeConfig()
 const baseURL=String(config.public.apiBase).replace(/\/$/,'')
 const auth=useClientAuth()
 const toast=useAppToast()
 const request=<T>(path:string,options:Record<string,any>={})=>{
  const {suppressToast=false,requiresAuth=false,redirectOn401=true,...fetchOptions}=options
  const headers:Record<string,string>={Accept:'application/json',...(options.headers||{})}
  if(requiresAuth&&auth.token.value)headers.Authorization=`Bearer ${auth.token.value}`
  const route=useRoute()
  return $fetch<T>(`${baseURL}${path}`,{...fetchOptions,headers}).catch(async error=>{
   if(responseStatus(error)===401&&requiresAuth){
    const hadToken=Boolean(auth.token.value)
    auth.clear()
    const protectedRoute=route.path.startsWith('/account/')&&!['/account/login','/account/forgot','/account/reset'].includes(route.path)
    if(hadToken&&redirectOn401&&protectedRoute)await auth.redirectToLogin(route.fullPath)
   }
   if(import.meta.client&&!suppressToast&&shouldAutoToast(error))toast.error(normalizeAppError(error).message)
   throw error
  })
 }
 return {
  request,
  counselors:(query:any={})=>useFetch<ApiCollection<Counselor>>(`${baseURL}/counselors`,{query,key:`counselors-${JSON.stringify(toValue(query))}`}),
  counselor:(slug:string)=>useFetch<ApiItem<Counselor>>(`${baseURL}/counselors/${encodeURIComponent(slug)}`,{key:`counselor-${slug}`}),
  specialties:()=>useFetch<ApiCollection<Specialty>>(`${baseURL}/specialties`,{key:'specialties'}),
  comments:(query:Record<string,string|number>={})=>useFetch<ApiCollection<Comment>>(`${baseURL}/comments`,{query,key:`comments-${JSON.stringify(query)}`}),
  content:(type:string,query:any={})=>useFetch<ApiCollection<CmsEntry>>(`${baseURL}/content/${encodeURIComponent(type)}`,{query,key:`content-${type}-${JSON.stringify(toValue(query))}`}),
  contentItem:(type:string,slug:string)=>useFetch<ApiItem<CmsEntry>>(`${baseURL}/content/${encodeURIComponent(type)}/${encodeURIComponent(slug)}`,{key:`content-${type}-${slug}`})
 }
}

function responseStatus(error:any){return Number(error?.statusCode||error?.status||error?.response?.status||0)}

export const collectionItems=<T=any>(response:any):T[]=>{
 const value=response?.data
 if(Array.isArray(value))return value
 if(Array.isArray(value?.data))return value.data
 return []
}
export const resourceItem=<T>(response:any):T|undefined=>response?.data?.data??response?.data
export const useMediaUrl=()=>{
 const config=useRuntimeConfig(),api=String(config.public.apiBase).replace(/\/api\/?$/,'').replace(/\/$/,'')
 return (path:string|null|undefined)=>{
  if(!path)return ''
  if(path.startsWith('data:'))return path
  if(/^(https?:)?\/\//i.test(path)){
   const value=path.replace('/storage//images/','/images/')
   try{
    const url=new URL(value,api),configured=new URL(api)
    if(['localhost','127.0.0.1','0.0.0.0'].includes(url.hostname)&&!['localhost','127.0.0.1','0.0.0.0'].includes(configured.hostname))url.host=configured.host
    return url.toString()
   }catch{return value}
  }
  if(path.startsWith('/images/'))return `${api}${path}`
  return `${api}/storage/${path.replace(/^\/?(storage\/)?/,'')}`
 }
}
