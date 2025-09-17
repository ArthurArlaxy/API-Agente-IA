# 🤖 Agente de IA com LangGraph

Este projeto demonstra a construção de um agente de IA inteligente para triagem e resposta automática, utilizando a biblioteca **LangGraph** em Node.js e TypeScript. O agente é capaz de analisar a intenção de uma pergunta do usuário e direcionar o fluxo para a ação apropriada:

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

### Estrutura de Arquivos

-   `src/agentIA.ts`: Contém toda a lógica do agente, incluindo a definição do grafo de estados, os nós (triagem, auto-resolver, etc.) e as funções de decisão.
-   `media/`: Diretório onde você deve colocar seus arquivos PDF para serem processados pelo sistema RAG.
-   `.env`: Arquivo de variáveis de ambiente para a chave de API.
-   `package.json`: Lista as dependências do projeto.

## 🧠 Lógica e Fluxo do Agente

A inteligência do agente é definida por um **grafo de estados**, que mapeia o fluxo de decisão de cada interação do usuário. A imagem abaixo ilustra a arquitetura do fluxo de trabalho:


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
