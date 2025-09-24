import { Request } from "express";

export interface UserPayload{
    id:number,
    username:string,
    email:string,
}

export interface AuthenticatedRequest extends Request{
    authenticatedUser?: UserPayload 
}