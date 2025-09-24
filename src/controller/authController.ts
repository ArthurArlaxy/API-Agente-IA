import { Handler } from "express"
import { z } from "zod"
import { User } from "../model/user"
import { HttpError } from "../types/HttpError"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import "dotenv/config";

const secretKey = process.env.SECRET_KEY

const RegisterRequestSchema = z.object({
    // Código responsavel por realizar a verificação do corpo da requisição de registro
    username: z.string().min(3, "Username must be at least 3 characters long"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(4, "Password must be at least 8 characters long")
})

const LoginRequestSchema = z.object({
    // Código responsavel por realizar a verificação do corpo da requisição de login
    email: z.string(),
    password: z.string()
})


export class AuthController {
    // POST /api/register
    register: Handler = (req, res) => {
        const registerBody = RegisterRequestSchema.parse(req.body)

        const exists = User.findByEmail(registerBody.email)
        if (exists) throw new HttpError(401, "User with that email already exists")

        const newUser = User.create(registerBody)
        res.json(newUser)
    }
    // GET /api/login
    login: Handler = (req, res) => {
        const loginBody = LoginRequestSchema.parse(req.body)
        const user = User.findByEmail(loginBody.email)

        if (!user) {
            throw new HttpError(404, "Invalid credentials")
        }

        if (bcrypt.compareSync(loginBody.password, user.password)) {
            const token = jwt.sign({id: user.id, username: user.username, email: user.email}, secretKey, { expiresIn: "1d" })
            return res.json({ token: token })
        }
        
        throw new HttpError(400, "Invalid credentials")
    }
}   