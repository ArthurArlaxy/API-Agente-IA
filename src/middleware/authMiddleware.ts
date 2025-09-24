import { Handler, Request } from "express";
import jwt from "jsonwebtoken"
import { HttpError } from "../types/HttpError";
import { AuthenticatedRequest, UserPayload } from "../types/AuthenticatedRequest";

const secretKey = process.env.SECRET_KEY

export const authMiddleware: Handler = (req, res, next) => {
    const authHeader = req.headers.authorization
    try {
        const token = authHeader.split(" ")[1]
        const user = jwt.verify(token, secretKey) as UserPayload

        (req as AuthenticatedRequest).authenticatedUser = user

        next()
    } catch (error) {
        throw new HttpError(400, "Invalid token")
    }
}