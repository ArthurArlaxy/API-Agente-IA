import express from "express"
import { AuthController } from "./controller/authController"


export const router = express.Router()
const authController = new AuthController()

router.post("/register", authController.register)