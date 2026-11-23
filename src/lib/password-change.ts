import type {SupabaseClient} from '@supabase/supabase-js';
export function validatePasswordChange(current:string,password:string,confirm:string){
 if(!current)return 'currentPasswordRequired';
 if(password.length<12)return 'passwordHint';
 if(password!==confirm)return 'passwordMismatch';
 if(password===current)return 'passwordSame';
 return null;
}
export function passwordError(error:{code?:string;status?:number}){
 if(error.status===429)return 'rateLimit';
 switch(error.code){
  case 'reauthentication_needed':return 'passwordCodeNeeded';
  case 'reauthentication_not_valid':case 'otp_expired':return 'passwordCodeInvalid';
  case 'invalid_credentials':case 'current_password_invalid':return 'currentPasswordWrong';
  case 'same_password':return 'passwordSame';
  case 'weak_password':return 'passwordWeak';
  case 'session_not_found':case 'refresh_token_not_found':case 'user_not_found':return 'loginRequired';
  default:return 'requestError';
 }
}
export async function changePassword(auth:SupabaseClient['auth'],current:string,password:string,nonce:string){
 const {error}=await auth.updateUser({current_password:current,password,...(nonce.trim()?{nonce:nonce.trim()}:{})});
 return error?passwordError(error):null;
}
