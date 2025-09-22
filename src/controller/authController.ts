import { Handler } from "express"
import { z } from "zod"
import { User } from "../model/user" 
import { HttpError } from "../error/HttpError"


const RegisterRequestSchema  = z.object({
    // Código responsavel por realizar a verificação do corpo da requisição
    username: z.string().min(3, "Username must be at least 3 characters long"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(4, "Password must be at least 8 characters long")
})


export class AuthController{
    // POST /api/register
    register:Handler = (req, res) => {
            const registerBody = RegisterRequestSchema.parse(req.body)
            const newUser = User.create(registerBody)
            res.json(newUser)
    }
    // GET /api/login
    // POST /api/logout
}