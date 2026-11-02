import type {ApiItem,ApiCollection} from '~/types/api'
import type {Booking,BookingService,BookingSlot,BookingPayment,BookingNote,BookingReceipt,ClientNotification,Client,CancellationRequest,ApiError} from '~/types/booking'
export const bookingMessage=(error:unknown,t:(key:any)=>string)=>{
 const e=error as ApiError
 const code=e?.statusCode||e?.status
 if(code===401)return t('unauthorized')
 if(code===403)return t('forbidden')
 if(code===409)return t('conflict')
 if(code===404)return t('notFound')
 if(code===422)return Object.values(e?.data?.errors||{}).flat().join(' ')||t('invalid')
 return e?.data?.message||t('error')
}
export const useBookingApi=()=>{
 const request=useBackend().request
 const authRequest=<T>(url:string,options:Record<string,any>={})=>request<T>(url,{...options,requiresAuth:true})
 return {
  authConfig:()=>request<{data:{recaptcha:{enabled:boolean;version:string;site_key:string|null};otp:{code_length:number;expires_in:number;resend_after:number}}}>('/auth/config',{suppressToast:true}),
  otpRequest:(body:{mobile:string;recaptcha_token:string;recaptcha_action:'otp_request'})=>request<OtpChallengeResponse>('/auth/otp/request',{method:'POST',body,suppressToast:true}),
  otpResend:(body:{mobile:string;recaptcha_token:string;recaptcha_action:'otp_resend'})=>request<OtpChallengeResponse>('/auth/otp/resend',{method:'POST',body,suppressToast:true}),
  otpVerify:(body:{mobile:string;challenge_id:string;code:string})=>request<OtpLoginResponse>('/auth/otp/verify',{method:'POST',body,suppressToast:true}),
  authStepUpRequest:(body:{recaptcha_token:string;recaptcha_action:'auth_step_up'})=>authRequest<OtpChallengeResponse>('/auth/otp/step-up/request',{method:'POST',body,suppressToast:true}),
  authStepUpVerify:(body:{challenge_id:string;code:string})=>authRequest<{success:boolean;data:{user:Client;token:null;profile_complete:boolean;missing_profile_fields:string[];mobile_verified:boolean;has_password:boolean}}>('/auth/otp/step-up/verify',{method:'POST',body,suppressToast:true}),
  authMe:()=>authRequest<ApiItem<Client> & {data:Client}>('/auth/me'),
  updateAuthProfile:(body:Pick<Client,'first_name'|'last_name'> & Partial<Pick<Client,'address'|'birth_date'>>)=>authRequest<ApiItem<Client> & {data:Client}>('/auth/profile',{method:'PUT',body}),
  setPassword:(body:{password:string;password_confirmation:string})=>authRequest<{success:boolean;data:{has_password:boolean}}>('/auth/password/set',{method:'POST',body}),
  mobileChangeRequest:(body:{mobile:string;recaptcha_token:string;recaptcha_action:'mobile_change'})=>authRequest<OtpChallengeResponse>('/auth/mobile/change/request',{method:'POST',body,suppressToast:true}),
  mobileChangeVerify:(body:{mobile:string;challenge_id:string;code:string})=>authRequest<{success:boolean;data:{user:Client;mobile_verified:boolean;profile_complete:boolean;has_password:boolean;missing_profile_fields:string[]}}>('/auth/mobile/change/verify',{method:'POST',body,suppressToast:true}),
  services:()=>request<ApiCollection<BookingService>>('/booking/services'),
  counselorServices:(id:number)=>request<ApiCollection<BookingService & {service_id:number}>>(`/booking/counselors/${id}/services`),
  availability:(counselor_id:number,service_id:number,date:string)=>request<{timezone:string;slots:BookingSlot[]}>('/booking/availability',{query:{counselor_id,service_id,date}}),
  login:(body:{email:string;password:string})=>request<{data:Client;token:string}>('/client/login',{method:'POST',body}),
  forgot:(email:string,recaptcha_token:string)=>request<{message:string}>('/client/password/forgot',{method:'POST',body:{email,recaptcha_token},suppressToast:true}),
  reset:(body:Record<string,string>)=>request<{message:string}>('/client/password/reset',{method:'POST',body}),
  me:()=>authRequest<ApiItem<Client>>('/client/me'),
  update:(body:Partial<Client>)=>authRequest<ApiItem<Client>>('/client/me',{method:'PATCH',body}),
  changePassword:(body:{current_password:string;password:string;password_confirmation:string})=>authRequest<{message:string}>('/client/password',{method:'PUT',body}),
  notificationPreferences:()=>authRequest<ApiItem<Record<string,unknown>>>('/client/notification-preferences'),
  updateNotificationPreferences:(body:Record<string,unknown>)=>authRequest<ApiItem<Record<string,unknown>>>('/client/notification-preferences',{method:'PATCH',body}),
  logout:()=>authRequest<void>('/client/logout',{method:'POST',suppressToast:true,redirectOn401:false}),
  reserve:(body:Record<string,string|number>)=>authRequest<ApiItem<Booking>>('/booking/reservations',{method:'POST',body}),
  mine:(page=1)=>authRequest<{data:Booking[];current_page:number;last_page:number}>('/booking/my-reservations',{query:{page}}),
  booking:(id:number)=>authRequest<ApiItem<Booking>>(`/booking/my-reservations/${id}`),
  payments:(id:number)=>authRequest<ApiCollection<BookingPayment>>(`/booking/my-reservations/${id}/payments`),
  receipts:(id:number)=>authRequest<ApiCollection<BookingReceipt>>(`/booking/my-reservations/${id}/receipts`),
  notifications:()=>authRequest<ApiCollection<ClientNotification>>('/client/notifications'),
  readNotification:(id:number)=>authRequest<void>(`/client/notifications/${id}/read`,{method:'POST'}),
  notes:(id:number)=>authRequest<ApiCollection<BookingNote>>(`/booking/my-reservations/${id}/notes`),
  initiate:(id:number,amount_irr:number,idempotency_key:string)=>authRequest<ApiItem<{payment_id:number;url:string|null;authority?:string;provider_authority?:string;checkout_token?:string;status?:string}>>(`/booking/my-reservations/${id}/payments`,{method:'POST',body:{amount_irr,idempotency_key}}),
  cancel:(id:number,reason:string)=>authRequest<ApiItem<CancellationRequest>>(`/booking/my-reservations/${id}/cancellation-request`,{method:'POST',body:{reason}}),
  reschedule:(id:number,starts_at:string)=>authRequest<ApiItem<Booking>>(`/booking/my-reservations/${id}/reschedule`,{method:'PATCH',body:{starts_at}}),
 }
}

export type OtpChallengeResponse={success:boolean;data:{challenge_id:string;expires_in:number;resend_after:number;code_length:number;accepted_requests_remaining:number;dev_otp?:string}}
export type OtpLoginResponse={success:boolean;token:string;data:Client;has_password:boolean;profile_complete:boolean;missing_profile_fields:string[];mobile_verified:boolean}
