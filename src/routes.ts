import express from "express"
import { AuthController } from "./controller/authController"
import { AgentController } from "./controller/agentController"
import { authMiddleware } from "./middleware/authMiddleware"


export const router = express.Router()
const authController = new AuthController()
const agentController = new AgentController()

router.post("/register", authController.register)
router.get("/login", authController.login)
router.get("/home", authMiddleware ,agentController.index)
router.get("/IaAgent", authMiddleware, agentController.chat)