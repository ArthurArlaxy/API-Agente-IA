// Importa as bibliotecas necessárias para a aplicação.
// fs e path: Para manipulação de arquivos e diretórios (PDFs).
// langchain/text_splitter: Para dividir documentos longos em pedaços menores (chunks).
// langchain/google-genai: Para interagir com o modelo Gemini da Google (LLM).
// @langchain/community/vectorstores/faiss: Para armazenamento e busca vetorial eficiente.
// langchain/document: Para representar os documentos processados.
// pdf-parse: Para extrair texto de arquivos PDF.
// langchain/core/messages, langchain/core/prompts, etc.: Componentes essenciais para construir as interações com o LLM.
// z: Zod, uma biblioteca para validação de esquemas de dados.
// @langchain/langgraph: A biblioteca central para construir o grafo de estados (workflow).
// dotenv/config: Para carregar variáveis de ambiente de um arquivo .env.
import * as fs from "fs";
import * as path from "path";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { Document } from "langchain/document"
import pdf from 'pdf-parse'
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { BaseRetriever } from "@langchain/core/retrievers";
import { z } from "zod";
import { StateGraph } from "@langchain/langgraph";
import { START, END } from "@langchain/langgraph";
import "dotenv/config";

// Carrega a chave de API do arquivo .env.
const API_KEY = process.env.API_KEY_GENAI;

// --- DEFINIÇÃO DOS ESQUEMAS ZOD PARA VALIDAÇÃO DE DADOS ---
// Define o esquema de dados para o resultado da triagem.
const triagemSchema = z.object({
    decisao: z.enum(["AUTO_RESOLVER", "PEDIR_INFO", "ABRIR_CHAMADO"]),
    urgencia: z.enum(["BAIXA", "MEDIA", "ALTA"]),
    camposFaltantes: z.array(z.string()),
});

// Define o esquema de dados para a resposta do RAG.
const answerSchema = z.object({
    answer: z.string(),
    citacoes: z.array(z.any()),
    findContext: z.boolean()
})

// Define o esquema completo do estado do agente (o "mapa" de dados que viaja pelo grafo).
const agentStateSchema = z.object({
    pergunta: z.string(),
    triagem: z.object({
        decisao: z.enum(["AUTO_RESOLVER", "PEDIR_INFO", "ABRIR_CHAMADO"]),
        urgencia: z.enum(["BAIXA", "MEDIA", "ALTA"]),
        camposFaltantes: z.array(z.string()),
    }),
    resposta: z.optional(z.string()),
    citacoes: z.array(z.any()),
    ragSucesso: z.boolean(),
    acaoFinal: z.optional(z.string())
})

// Define os tipos TypeScript a partir dos esquemas Zod para tipagem forte.
type TriagemOutput = z.infer<typeof triagemSchema>
type AnswerOutput = z.infer<typeof answerSchema>
type AgentState = z.infer<typeof agentStateSchema>

// Inicializa a instância do LLM da Google (Gemini-2.5-flash).
const llm: ChatGoogleGenerativeAI = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0.0,
    apiKey: API_KEY,
});

// O prompt do sistema para a etapa de triagem.
// Instruí o LLM a atuar como um triador e a retornar estritamente um JSON.
const TRIAGEM_PROMPT: string =
    "Você é um triador de Service Desk para políticas internas da empresa Arlaxy Desenvolvimento. " +
    "Sua tarefa é analisar a mensagem do usuário e categorizá-la. " +
    "Estritamente, retorne APENAS o objeto JSON, sem nenhum texto adicional antes ou depois. " +
    "O objeto deve seguir este formato:\n" +
    '{\n "decisao": "AUTO_RESOLVER" | "PEDIR_INFO" | "ABRIR_CHAMADO",\n' +
    ' "urgencia": "BAIXA" | "MEDIA" | "ALTA",\n' +
    ' "camposFaltantes": ["..."]\n' +
    "}\n" +
    "Regras para categorização:\n" +
    '- **AUTO_RESOLVER**: Perguntas diretas sobre políticas existentes. Ex: "Posso reembolsar a internet do meu home office?"\n' +
    '- **PEDIR_INFO**: Mensagens vagas ou que exigem mais detalhes. Ex: "Tenho uma dúvida geral sobre políticas."\n' +
    '- **ABRIR_CHAMADO**: Pedidos de exceção, aprovação ou solicitações explícitas para abrir um chamado. Ex: "Por favor, abra um chamado para o RH."\n' +
    "Analise a mensagem do usuário com base nessas regras." +
    'exemplo de resposta:{"decisao": "PEDIR_INFO","urgencia": "BAIXA","camposFaltantes": ["qual política", "qual a dúvida/problema"]} ' +
    "O que não escrever(```, json)";

// Função de triagem: Invoca o LLM para classificar a pergunta do usuário.
// Retorna um objeto `TriagemOutput` validado ou null em caso de falha.
async function triagem(message: string): Promise<TriagemOutput | null> {
    try {
        const chat = [
            new SystemMessage({ content: TRIAGEM_PROMPT }),
            new HumanMessage({ content: ` Mensagem do usuário: ${message}` }),
        ];
        const output = await llm.invoke(chat);
        const parsedSaida = JSON.parse(output.content as string);
        const validacoes = triagemSchema.safeParse(parsedSaida);
        if (validacoes.success) {
            return validacoes.data;
        } else {
            console.log(`Erro de validação`);
            return null;
        }
    } catch (error) {
        console.log(`Erro ao chamar a IA: ${error}`);
        return null;
    }
}

// Lista de perguntas de teste para simular a entrada do usuário.
const perguntasDeTeste = [
    "Como funciona a política de reembolso para viagens corporativas?",
    "Qual o processo para solicitar férias?",
    "O que a empresa diz sobre o uso do vale-alimentação?",
    "O gerente me pediu para abrir um chamado para liberação do acesso ao sistema X.",
    "Quero que o RH entre em contato comigo, preciso discutir a minha situação.",
    "Quem descobriu o Brasil?"
];

// --- RAG (Retrieval Augmented Generation) ---
// 1. Carregamento e processamento dos documentos PDF.
async function loadPDFDocuments(directory: string) {
    const documents: Document[] = [];
    const files = fs.readdirSync(directory);
    for (const file of files) {
        if (path.extname(file) === ".pdf") {
            const filePath = path.resolve(directory, file);
            try {
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdf(dataBuffer)
                const doc = new Document({ pageContent: data.text })
                documents.push(doc)
            } catch (error) {
                console.log(`Arquivo ${file} falhou ao ser carregado`)
            }
        }
    }
    return documents
}

// 2. Divisão dos documentos em 'chunks' (pedaços menores).
async function splitDocument(docs: Document[]): Promise<Document[]> {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 300,
        chunkOverlap: 30,
    })
    const chunks = await splitter.splitDocuments(docs)
    return chunks
}

// 3. Criação de embeddings (representações numéricas) e armazenamento vetorial (Faiss).
async function createVectorStore(chunks: Document[]): Promise<FaissStore> {
    const embeddings = new GoogleGenerativeAIEmbeddings({
        model: "models/gemini-embedding-001",
        apiKey: API_KEY
    })
    const vectorStore = await FaissStore.fromDocuments(chunks, embeddings)
    return vectorStore
}

// Função para criar o retriever, que busca os documentos mais relevantes.
async function createRetriever() {
    const documents = await loadPDFDocuments(path.resolve("./src/media"))
    const splitedDocument = await splitDocument(documents)
    const vectorStore = await createVectorStore(splitedDocument)
    const retriever = vectorStore.asRetriever({
        searchType: "similarity",
        k: 4
    })
    return retriever
}

// --- Cadeia de Documentos e Geração de Resposta ---
// O prompt para a etapa de RAG, que usa o contexto e a pergunta para gerar a resposta.
const prompt_rag = ChatPromptTemplate.fromTemplate(
    "Você é um Assistente de Políticas Internas (RH/IT) da empresa Arlaxy Desenvolvimento. " +
    "Responda com base no contexto fornecido. " +
    "Caso o contexto seja sufuciente de uma resposta completa, ou seja, sem ser um objeto json"+
    "Se não houver base suficiente, responda apenas 'Não sei.'.\n\n" +
    "Pergunta: {input}\n\n" +
    "Contexto:\n{context}"
);

// Cria a cadeia de documentos, que combina o prompt com o LLM.
async function createDocumentChain() {
    const documentChain = await createStuffDocumentsChain({
        llm: llm,
        prompt: prompt_rag
    })
    return documentChain
}

// Função central do RAG: busca documentos e gera a resposta final.
async function perguntarPoliticaRAG(question: string, retriever: BaseRetriever): Promise<AnswerOutput> {
    const docsRel = await retriever.invoke(question)
    const documentChain = await createDocumentChain()
    if (docsRel.length === 0) {
        return {
            answer: "não sei",
            citacoes: [],
            findContext: false
        }
    }
    const answer = await documentChain.invoke({
        input: question,
        context: docsRel
    })
    if (answer.trim() === "Não sei.") {
        return {
            answer: "Não sei.",
            citacoes: [],
            findContext: false
        }
    }
    const citacoes = docsRel.map((doc) => doc.pageContent);
    return {
        answer,
        citacoes: citacoes,
        findContext: true,
    };
}

// --- NÓS DO GRAFO ---
// Cada função de nó recebe o estado atual e retorna um objeto parcial para atualizá-lo.

// Nó de triagem: Executa a função 'triagem' e atualiza o estado com o resultado.
async function nodeTriagem(state: AgentState): Promise<Partial<AgentState>> {
    console.log(`Executando nó de triagem...`)
    const resultadotriagem = await triagem(state["pergunta"])
    return {
        "triagem": resultadotriagem
    }
}

// Nó de auto-resolução: Executa o RAG e atualiza o estado com a resposta gerada.
async function nodeAutoResolver(state: AgentState): Promise<Partial<AgentState>> {
    console.log(`Executando nó de auto Resolver...`)
    const retriever = await createRetriever()
    const respostaRag = await perguntarPoliticaRAG(state["pergunta"], retriever)
    const update: Partial<AgentState> = {
        "resposta": respostaRag.answer,
        "citacoes": respostaRag.citacoes,
        "ragSucesso": respostaRag.findContext
    }
    if (respostaRag.findContext) update.acaoFinal = "AUTO_RESOLVER"
    return update
}

// Nó de pedir informações: Gera uma resposta padrão pedindo mais detalhes.
function nodePedirInfo(state: AgentState): Partial<AgentState> {
    console.log(`Executando nó de pedir info...`)
    const faltantes = state["triagem"].camposFaltantes
    let detalhe: string = ""
    if (faltantes.length > 0) {
        detalhe = faltantes.join(",")
    } else {
        detalhe = "Tema e contexto específico"
    }
    return {
        "resposta": `Para avançar preciso que detalhe: ${detalhe}. Para que eu possa responder melhor, por favor, refaça a pergunta`,
        "citacoes": [],
        "acaoFinal": "PEDIR_INFO"
    }
}

// Nó de abrir chamado: Gera uma resposta simulando a abertura de um chamado.
function nodeAbrirChamado(state: AgentState): Partial<AgentState> {
    console.log("Executando o nó abrir chamado...")
    const triagem = state.triagem
    return {
        resposta: `Abrindo chamado com urgência ${triagem.urgencia}, descrição: ${state.pergunta.slice(0, 140)}`,
        citacoes: [],
        acaoFinal: "ABRIR_CHAMADO"
    }
}

// --- FUNÇÕES DE DECISÃO ---
// Funções que direcionam o fluxo do grafo com base no estado atual.
const keywordsAbrirTicket = ["aprovação", "exceção", "liberação", "abrir ticket", "abrir chamado", "acesso especial"]

// Decide para onde ir após a triagem.
function decidirPosTriagem(state: AgentState): "auto" | "info" | "chamado" {
    console.log("Executando função de decidir pós triagem")
    const decisao = state.triagem.decisao
    if (decisao === "AUTO_RESOLVER") return "auto"
    if (decisao === "ABRIR_CHAMADO") return "chamado"
    if (decisao === "PEDIR_INFO") return "info"
    return "auto"
}

// Decide para onde ir após a tentativa de auto-resolução.
function decidirPosAutoResolver(state: AgentState): "ok" | "info" | "chamado" {
    console.log("Executando função de decidir pós auto resolver")
    if (state.ragSucesso) {
        console.log("Rag com sucesso, finalizando fluxo")
        return "ok"
    }
    const stateDaPergunta = (state.pergunta ?? "").toLowerCase()
    if (keywordsAbrirTicket.some(keyword => stateDaPergunta.includes(keyword))) {
        console.log("RAG falhou, mas keywords de aberura de ticket foram encontradas, abrindo chamado")
        return "chamado"
    }
    console.log("RAG falou e nenhuma keyword foi encontrada. Pedindo mais informações.")
    return "info"
}

// --- CONSTRUÇÃO E COMPILAÇÃO DO GRAFO ---
// Monta o fluxo de trabalho do agente, conectando os nós e as decisões.
async function construirGrafo() {
    const app = new StateGraph({ state: agentStateSchema })
        // Adiciona todos os nós do grafo.
        .addNode("triagem_node", nodeTriagem)
        .addNode("auto_resolver", nodeAutoResolver)
        .addNode("pedir_info", nodePedirInfo)
        .addNode("abrir_chamado", nodeAbrirChamado)

        // Define a aresta inicial que começa o fluxo.
        .addEdge(START, "triagem_node")

        // Define as arestas condicionais que direcionam o fluxo após a triagem.
        .addConditionalEdges("triagem_node", decidirPosTriagem, {
            "auto": "auto_resolver",
            "info": "pedir_info",
            "chamado": "abrir_chamado",
        })
        // Define as arestas condicionais após a tentativa de auto-resolução.
        .addConditionalEdges("auto_resolver", decidirPosAutoResolver, {
            "info": "pedir_info",
            "chamado": "abrir_chamado",
            "ok": END,
        })
        // Define as arestas que levam ao fim do grafo.
        .addEdge("pedir_info", END)
        .addEdge("abrir_chamado", END)
        // Compila o grafo para que ele possa ser invocado.
        .compile();
    return app;
}

// --- EXECUÇÃO DO AGENTE ---
// Cria uma instância do grafo fora da função principal.
const app = construirGrafo()

// Função de log para teste do Agente que executa o fluxo para cada pergunta de teste.
async function logAgentIA() {
    for (const question of perguntasDeTeste) {
        // Invoca o grafo com a pergunta inicial.
        const respotaFinal = (await app).invoke({ "pergunta": question })

        // Acessa o estado final do grafo.
        const answerTriagem = (await respotaFinal).triagem

        // Imprime o resultado formatado.
        console.log(`PERGUNTA: ${question}\n`)
        console.log(`DECISÃO: ${answerTriagem.decisao} | URGENCIA ${answerTriagem.urgencia} | AÇÃO FINAL: ${(await respotaFinal).acaoFinal}\n`)
        console.log(`RESPOSTA: ${(await respotaFinal).resposta}\n`)
        if ((await respotaFinal).citacoes.length > 0) {
            console.log("CITAÇÕES:")
            for (const citacao of (await respotaFinal).citacoes) {
                console.log(citacao)
            }
        }
        console.log("--------------------------------------------")
    }
}


// função principal
export async function agentIA(pergurta:string) {

        // Invoca o grafo com a pergunta inicial.
        const respotaFinal = (await app).invoke({ "pergunta": pergurta })

        // Acessa o estado final do grafo.
        const answerTriagem = (await respotaFinal).triagem

        // Imprime o resultado formatado.
        console.log(`PERGUNTA: ${pergurta}\n`)
        console.log(`DECISÃO: ${answerTriagem.decisao} | URGENCIA ${answerTriagem.urgencia} | AÇÃO FINAL: ${(await respotaFinal).acaoFinal}\n`)
        console.log(`RESPOSTA: ${(await respotaFinal).resposta}\n`)
        if ((await respotaFinal).citacoes.length > 0) {
            console.log("CITAÇÕES:")
            for (const citacao of (await respotaFinal).citacoes) {
                console.log(citacao)
            }
        console.log("--------------------------------------------")
    }

    return (await respotaFinal).resposta
}