export function normalizeAppError(error:unknown):{status:number;code?:string;message:string;retryAfter?:number;cancelled?:boolean}
export function shouldAutoToast(error:unknown):boolean
export function isDuplicateToast(previous:{kind:string;message:string;at:number}|undefined,kind:string,message:string,now:number,windowMs?:number):boolean
export function createSingleFlight():<T>(key:string,task:()=>Promise<T>)=>Promise<T>
