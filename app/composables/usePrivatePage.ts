import {normalizeAppError} from '~/composables/toastUtils.mjs'
export const usePrivatePage=()=>{
 const auth=useClientAuth(),{path}=useSiteLocale(),route=useRoute(),api=useBookingApi(),toast=useAppToast()
 const ensure=async()=>{
  auth.restore()
  if(!auth.token.value){await auth.redirectToLogin(route.fullPath);return false}
  if(auth.validated.value&&auth.client.value)return true
  try{return Boolean(await auth.validateSession(()=>api.authMe()))}
  catch(error){const status=Number((error as any)?.statusCode||(error as any)?.status||(error as any)?.response?.status||0);if(status===401){auth.clear();await auth.redirectToLogin(route.fullPath)}else toast.error(normalizeAppError(error).message);return false}
 }
 return {auth,ensure}
}
