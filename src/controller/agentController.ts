import { Handler } from "express";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";
import { agentIA } from "../model/agentIA-Model";
import { z } from "zod"

const RequestChatSchema = z.object({
    message: z.string()
})

export class AgentController{
    index: Handler = (req: AuthenticatedRequest, res) => {
        const user = req.authenticatedUser
        res.json({message: `${user.username}, seja bem-vindo! Sou a inteligencia Artificial da Arlaxy Desenvolvimento e irei te ajudar com suas dúvidas `})
    }

    chat: Handler = async (req: AuthenticatedRequest, res) => {
        const user = req.authenticatedUser
        const {message} = RequestChatSchema.parse(req.body)

        const answer = await agentIA(`Meu nome é ${user.username} e minha pergunta é: ${message}`)

        res.json({answer})
    }
}