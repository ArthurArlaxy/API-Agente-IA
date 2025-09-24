import { HttpError } from "../types/HttpError";
import { z } from "zod"
import { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message })
    } else if (err instanceof z.ZodError) {
        res.status(400).json({ error: err.errors.map(err => err.message) })
    } else {
        res.status(500).json({ error: err.message })
    }
}