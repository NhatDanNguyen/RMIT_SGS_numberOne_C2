export type Page = 'room'|'quotes'|'requests'|'buyer'|'activity'|'setup';
export type Config={mode:'tide'|'simulation';configured:boolean;issue:string;adapter:Record<string,unknown>|null;consoleUrl:string;setupUrl:string;governance:{targetAdmins:number;targetApprovals:number;verified:boolean}};
export type Member={sub:string;name:string;roles:string[]};
export type QuoteState={supplier:string;recordId:string;status:string;version:number;updatedAt:string|null;policyStored:boolean;canRead:boolean;canWrite:boolean};
export type QuotePlain={amount:number;currency:string;timeline:string;note:string};
export type AccessRequest={id:string;supplier:string;recipient_sub:string;recipient_name:string;reason:string;created_at:string;role:string;status:string};
export type Activity={id:string;actor:string;action:string;supplier:string|null;created_at:string};
