import type {Client} from '~/types/booking'
import {createSingleFlight} from '~/composables/toastUtils.mjs'
const authCheckFlight=createSingleFlight()
const responseStatus=(error:any)=>Number(error?.statusCode||error?.status||error?.response?.status||0)
export const useClientAuth=()=>{
 const token=useState<string|null>('client-token',()=>null)
 const client=useState<Client|null>('client-profile',()=>null)
 const ready=useState<boolean>('client-auth-ready',()=>false)
 const validated=useState<boolean>('client-auth-validated',()=>false)
 const redirecting=useState<boolean>('client-auth-redirecting',()=>false)
 const generation=useState<number>('client-auth-generation',()=>0)
 const restore=()=>{if(import.meta.client&&!ready.value){token.value=sessionStorage.getItem('client-token');ready.value=true}}
 const setSession=(value:string,profile:Client)=>{generation.value++;token.value=value;client.value=profile;validated.value=true;if(import.meta.client)sessionStorage.setItem('client-token',value);ready.value=true}
 const clear=()=>{generation.value++;token.value=null;client.value=null;validated.value=false;if(import.meta.client)sessionStorage.removeItem('client-token')}
 const validateSession=(fetchMe:()=>Promise<{data:Client}>,force=false):Promise<Client|null>=>{
  restore()
  const expectedToken=token.value
  const expectedGeneration=generation.value
  if(!expectedToken)return Promise.resolve(null)
  if(!force&&validated.value&&client.value)return Promise.resolve(client.value)
  return authCheckFlight(`client-auth-me:${expectedGeneration}`,async()=>{
   if(token.value!==expectedToken||generation.value!==expectedGeneration)return client.value
   try{
    const response=await fetchMe()
    if(token.value!==expectedToken||generation.value!==expectedGeneration)return client.value
    client.value=response.data;validated.value=true
    return response.data
   }catch(error){
    if(responseStatus(error)===401&&token.value===expectedToken)clear()
    throw error
   }
  })
 }
 const redirectToLogin=async(destination:string)=>{
  if(redirecting.value)return
  const route=useRoute(),{path}=useSiteLocale()
  const unsafe=destination.includes('\\')||Array.from(destination).some(char=>char.charCodeAt(0)<32)
  const safe=destination.startsWith('/')&&!destination.startsWith('//')&&!unsafe?destination:path('/account/appointments')
  if(route.path===path('/account/login'))return
  redirecting.value=true
  try{await navigateTo({path:path('/account/login'),query:{redirect:safe}})}finally{setTimeout(()=>redirecting.value=false,0)}
 }
 return {token,client,ready,validated,redirecting,restore,setSession,clear,validateSession,redirectToLogin}
}
