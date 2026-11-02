import type {OtpChallengeResponse} from '~/composables/useBookingApi'
import {normalizePersianDigits,normalizeIranianMobile,validIranianMobile} from '~/composables/otpAuthUtils.mjs'
import {createSingleFlight} from '~/composables/toastUtils.mjs'
import {executeRecaptchaV3} from '~/composables/recaptchaV3.mjs'

export type OtpPurpose='login'|'mobile_change'|'step_up'
type OtpChallenge={id:string;mobile:string;purpose:OtpPurpose;expiresAt:number;resendAt:number;codeLength:number}
type AuthConfig={recaptcha:{enabled:boolean;version:string;site_key:string|null};otp:{code_length:number;expires_in:number;resend_after:number}}
const singleFlight=createSingleFlight()

export const useOtpAuth=()=>{
 const api=useBookingApi()
 const config=useState<AuthConfig|null>('otp-auth-config',()=>null)
 const challenge=useState<OtpChallenge|null>('otp-auth-challenge',()=>null)
 async function loadConfig(force=false){
  if(force)config.value=null
  if(config.value)return config.value
  return singleFlight('public-auth-config',async()=>{const response=await api.authConfig();config.value=response.data;return response.data})
 }
 async function recaptchaToken(action:'otp_request'|'otp_resend'|'mobile_change'|'auth_step_up'|'password_reset_request'){
  if(!import.meta.client)throw new Error('CAPTCHA_UNAVAILABLE')
  let publicConfig:AuthConfig
  try{publicConfig=await loadConfig()}catch{throw new Error('CAPTCHA_UNAVAILABLE')}
  const key=publicConfig.recaptcha?.site_key
  if(publicConfig.recaptcha?.version!=='v3'||!key||!publicConfig.recaptcha.enabled)throw new Error('CAPTCHA_UNAVAILABLE')
  return executeRecaptchaV3(key,action)
 }
 function persist(){if(!import.meta.client)return;try{challenge.value?sessionStorage.setItem('otp-pending-challenge',JSON.stringify(challenge.value)):sessionStorage.removeItem('otp-pending-challenge')}catch{/* Storage is optional. */}}
 function restore(){
  if(!import.meta.client||challenge.value)return challenge.value
  try{const value=sessionStorage.getItem('otp-pending-challenge');if(!value)return null;const parsed=JSON.parse(value) as OtpChallenge;if(!parsed.id||!parsed.mobile||parsed.expiresAt<=Date.now()){sessionStorage.removeItem('otp-pending-challenge');return null}challenge.value=parsed;return parsed}catch{return null}
 }
 function clear(){challenge.value=null;persist()}
 function cooldownSeconds(mobileInput:string){
  const mobile=normalizeIranianMobile(mobileInput),key=`otp-cooldown:${mobile}`
  let until=challenge.value?.mobile===mobile?challenge.value.resendAt:0
  if(import.meta.client){try{until=Math.max(until,Number(sessionStorage.getItem(key))||0)}catch{/* Storage is optional. */}}
  return Math.max(0,Math.ceil((until-Date.now())/1000))
 }
 function delayResend(seconds:number,mobileInput=challenge.value?.mobile||'',authoritative=false){
  const until=Date.now()+Math.max(1,seconds)*1000
  if(challenge.value&&challenge.value.mobile===normalizeIranianMobile(mobileInput||challenge.value.mobile)){challenge.value.resendAt=authoritative?until:Math.max(challenge.value.resendAt,until);persist()}
  if(import.meta.client&&mobileInput){try{sessionStorage.setItem(`otp-cooldown:${normalizeIranianMobile(mobileInput)}`,String(until))}catch{/* Storage is optional. */}}
 }
 async function request(mobileInput:string,purpose:OtpPurpose='login',resend=false){
  const mobile=normalizeIranianMobile(mobileInput)
  if(!validIranianMobile(mobile))throw new Error('MOBILE_INVALID')
  const seconds=cooldownSeconds(mobile)
  if(seconds>0){const issue=Object.assign(new Error('OTP_COOLDOWN'),{retry_after_seconds:seconds});throw issue}
  const action=purpose==='step_up'?'auth_step_up':purpose==='mobile_change'?'mobile_change':resend?'otp_resend':'otp_request'
  return singleFlight(`otp:${action}:${mobile}`,async()=>{
   // Keep protected API dispatch in this same task and strictly after config,
   // Google script readiness, and a fresh action-bound token have all resolved.
   const recaptcha_token=await recaptchaToken(action as 'otp_request'|'otp_resend'|'mobile_change'|'auth_step_up')
   if(typeof recaptcha_token!=='string'||!recaptcha_token.trim())throw new Error('CAPTCHA_UNAVAILABLE')
   const payload={mobile,recaptcha_token,recaptcha_action:action as 'otp_request'|'otp_resend'|'mobile_change'|'auth_step_up'}
   return purpose==='step_up'?api.authStepUpRequest({recaptcha_token,recaptcha_action:'auth_step_up'}):purpose==='mobile_change'?api.mobileChangeRequest(payload as {mobile:string;recaptcha_token:string;recaptcha_action:'mobile_change'}):resend?api.otpResend(payload as {mobile:string;recaptcha_token:string;recaptcha_action:'otp_resend'}):api.otpRequest(payload as {mobile:string;recaptcha_token:string;recaptcha_action:'otp_request'})
  }).then(response=>{
   const accepted=response.data
   challenge.value={id:accepted.challenge_id,mobile,purpose,expiresAt:Date.now()+accepted.expires_in*1000,resendAt:Date.now()+accepted.resend_after*1000,codeLength:accepted.code_length||6};persist();delayResend(accepted.resend_after,mobile,true)
   return accepted
  })
 }
 async function verify(codeInput:string):Promise<unknown>{
  const current=challenge.value||restore();if(!current)throw new Error('OTP_EXPIRED')
  const code=normalizePersianDigits(codeInput).replace(/\D/g,'');if(code.length!==current.codeLength)throw new Error('OTP_INVALID')
  return singleFlight<unknown>(`otp-verify:${current.id}:${code}`,()=>{const payload={mobile:current.mobile,challenge_id:current.id,code};return current.purpose==='step_up'?api.authStepUpVerify({challenge_id:current.id,code}):current.purpose==='mobile_change'?api.mobileChangeVerify(payload):api.otpVerify(payload)})
 }
 return{config,challenge,loadConfig,recaptchaToken,request,verify,restore,clear,delayResend,cooldownSeconds}
}
