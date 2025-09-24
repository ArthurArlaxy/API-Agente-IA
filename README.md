# 🌐 API REST - Agente de IA com LangGraph e RAG

Este projeto é uma **API REST** construída em **Node.js** e **TypeScript**, com autenticação baseada em **JWT (JSON Web Token)**.  
A API fornece endpoints para interação com um **agente de IA** que utiliza a biblioteca **LangGraph** e a técnica **RAG (Retrieval-Augmented Generation)** para responder perguntas de forma contextualizada.

---

## 🚀 Funcionalidades

- 📝 **Registro de usuários (Register):** criação de contas com e-mail, usuário e senha.  
- 🔑 **Login (Login):** autenticação de usuários com retorno de **JWT**.  
- 🏠 **Home (Home):** endpoint protegido que retorna uma mensagem personalizada de boas-vindas com o nome do usuário.  
- 💬 **Chat (Chat):** recebe uma mensagem em JSON e responde com base no fluxo do **LangGraph** + **RAG**, utilizando documentos como fonte de contexto.  

> 🔒 Todas as rotas (exceto `register` e `login`) são protegidas por **JWT**.

---

## 📌 Futuro do Projeto

- 🔗 Integração com um **front-end em React** para consumir a API.  
- 🎨 Interface amigável para o usuário interagir com o agente de IA.  
- ⚡ Melhorias na experiência de conversa e personalização das respostas.  

---

# 🤖 Agente de IA

-   **Auto-resolução (RAG):** Responde a perguntas com base em documentos internos (PDFs) através de um fluxo de Geração Aumentada por Recuperação (RAG).
-   **Pedido de Informações:** Solicita mais detalhes ao usuário se a pergunta for ambígua ou incompleta.
-   **Abertura de Chamado:** Cria uma solicitação formal (simulada) para a equipe de suporte (RH/TI) se o problema exigir intervenção humana.

A arquitetura do agente é construída como um grafo de estados, permitindo um controle complexo e visual do fluxo de tomada de decisão.


### Configuração da Chave de API

O projeto utiliza a API Gemini da Google para a lógica do agente. Você precisa obter uma chave de API e configurá-la como uma variável de ambiente.

1.  Crie um arquivo chamado `.env` na raiz do projeto.
2.  Adicione sua chave de API ao arquivo, conforme o exemplo abaixo:

    ```env
    API_KEY_GENAI=sua_chave_de_api_aqui
    ```

    > **Importante:** Nunca envie seu arquivo `.env` para o GitHub. Ele já está incluído no `.gitignore` deste projeto para sua segurança.

### 📂 Estrutura de Arquivos

-   `src/controller/`: Contém os controladores principais (`agentController.ts` e `authController.ts`) responsáveis pela lógica das rotas.  
-   `src/middleware/`: Middlewares globais, como autenticação JWT (`authMiddleware.ts`) e tratamento de erros (`errorHandlerMiddleware.ts`).  
-   `src/model/`: Modelos da aplicação, incluindo definição de usuários (`user.ts`) e do agente de IA (`agentIA-Model.ts`).  
-   `src/types/`: Tipos e interfaces TypeScript para tipagem forte (`AuthenticatedRequest.ts`, `HttpError.ts`).  
-   `src/routes.ts`: Define as rotas principais da API (`register`, `login`, `home`, `chat`).  
-   `src/server.ts`: Arquivo principal para inicialização do servidor Express.  
-   `media/`: Diretório onde ficam os documentos PDF utilizados pelo RAG (ex.: políticas internas).  
-   `.env`: Arquivo de variáveis de ambiente (contém a chave da API Gemini e a chave secreta JWT).  
-   `package.json`: Lista as dependências e scripts do projeto.  
-   `tsconfig.json`: Configurações do compilador TypeScript.  eto.

## 🧠 Lógica e Fluxo do Agente

A inteligência do agente é definida por um **grafo de estados**, que mapeia o fluxo de decisão de cada interação do usuário. A imagem abaixo ilustra a arquitetura do fluxo de trabalho:

<img src="https://iili.io/KRMFXh7.md.png" alt="funcionamento-do-grafo" border="0">

### Explicação do Grafo

1.  **Início (`Start`) e Triagem (`Triage`):** O processo começa com a entrada de uma nova pergunta. O agente, através de uma chamada ao LLM, faz a triagem da mensagem para entender a intenção do usuário.
2.  **Fluxo de Decisão:** Com base na triagem, o fluxo se divide em três caminhos possíveis:
    -   **`AUTO_RESOLVER`**: Para perguntas claras sobre políticas internas que podem ser respondidas automaticamente com a ajuda de documentos (RAG).
    -   **`PEDIR_INFO`**: Se a pergunta for ambígua ou incompleta, o agente pede mais detalhes.
    -   **`ABRIR_CHAMADO`**: Para solicitações que precisam de ação humana, como aprovações ou problemas técnicos.
3.  **Fluxo do RAG (`AUTO_RESOLVER`):** Após o RAG tentar encontrar uma resposta, ele toma uma nova decisão:
    -   Se a resposta for encontrada, o fluxo termina (`End`).
    -   Se a resposta não for encontrada, o fluxo pode ser redirecionado para `ABRIR_CHAMADO` (se a pergunta contiver palavras-chave como "liberação" ou "aprovação") ou `PEDIR_INFO` (para obter mais contexto).
4.  **Finalização (`End`):** Os caminhos `PEDIR_INFO` e `ABRIR_CHAMADO` encerram o fluxo imediatamente após gerar a resposta ou simular a abertura do chamado.

---

### **Validação de Dados com Zod**

O **Zod** é uma ferramenta crucial neste projeto para garantir a segurança e a integridade dos dados. Ele é usado para validar a resposta JSON que o modelo de IA retorna na etapa de triagem.

-   **O que é?** Zod é uma biblioteca de declaração e validação de esquemas. Ela garante que um objeto de dados (como o JSON da IA) corresponda a uma estrutura e tipos pré-definidos (`decisao`, `urgencia`, etc.).
-   **Por que usamos?** O Zod previne que respostas inválidas ou mal-formatadas do LLM causem erros na aplicação, tornando o fluxo do grafo mais robusto e previsível. Além disso, ele nos permite derivar tipos TypeScript diretamente do esquema, proporcionando uma segurança de código ainda maior.

### **REFERÊNCIA**

Esse projeto foi totalmente inspirado e espelhado na Imersão Dev Agente de IA da Alura com o Google Gemini!
