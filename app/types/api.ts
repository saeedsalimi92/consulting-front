export type Specialty={id:number;title:string;slug:string;is_active:boolean}
export type Counselor={id:number;name:string;slug:string;avatar_url:string|null;bio:string|null;about:string|null;degree:string|null;years_of_experience:number|null;meta_title:string|null;meta_description:string|null;specialties:Specialty[];socials?:Record<string,string|null>}
export type Comment={id:number;body:string;parent_id:number|null;created_at:string}
export type ApiCollection<T>={data:T[];links?:unknown;meta?:unknown}
export type ApiItem<T>={data:T}
