
import { GoogleGenAI } from "@google/genai";
import { Flashcard } from "../metaService";

// ==================================================================================
// ÁREA DE DEBUG DE CONEXÃO
// ==================================================================================

// Removido inicialização global para evitar crash se process.env for undefined
// const ai = new GoogleGenAI({ apiKey: API_KEY }); <-- CAUSADOR DO CRASH

interface AIFlashcardResult {
  question: string;
  answer: string;
}

/**
 * Converte arquivo (File) para o formato Part esperado pelo Gemini SDK
 * Remove o prefixo Data URI para enviar apenas o payload Base64 limpo.
 */
async function fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onloadend = () => {
      const result = reader.result as string;
      
      // Extrai apenas a parte Base64 após a vírgula
      // Ex: "data:application/pdf;base64,JVBERi0..." -> "JVBERi0..."
      const base64Data = result.includes(',') ? result.split(',')[1] : result;

      console.log(`[FlashcardGenerator] Arquivo preparado: ${file.name} (${file.type}). Bytes: ${base64Data.length}`);

      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type || "application/pdf",
        },
      });
    };
    
    reader.onerror = (error) => {
      console.error("[FlashcardGenerator] Erro ao ler arquivo:", error);
      reject(error);
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Gera Flashcards a partir de múltiplos arquivos PDF usando Gemini
 */
export async function generateFlashcardsFromDocuments(files: File[]): Promise<Flashcard[]> {
  const API_KEY = process.env.API_KEY || '';
  
  // Log de Diagnóstico (Mascarado para segurança no console)
  const maskedKey = API_KEY 
    ? `${API_KEY.substring(0, 6)}...${API_KEY.substring(API_KEY.length - 4)}` 
    : "UNDEFINED/VAZIA";

  try {
    // 1. Validação Rigorosa da Key
    if (!API_KEY) {
      console.error("[FlashcardGenerator] ERRO FATAL: API Key não encontrada.");
      throw new Error("Erro de Configuração: API Key do Google (process.env.API_KEY) não foi encontrada.");
    }

    // INICIALIZAÇÃO TARDIA (LAZY)
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    if (!files || files.length === 0) {
      throw new Error("Nenhum arquivo fornecido.");
    }

    console.log(`[FlashcardGenerator] Processando ${files.length} arquivos com Gemini 3 Flash...`);

    // 2. Preparar Arquivos (Todos em paralelo)
    const fileParts = await Promise.all(files.map(fileToGenerativePart));

    // 3. Prompt Otimizado para JSON (Contexto Multi-Documento)
    const prompt = `
      Você é um sistema especialista em criar Flashcards de Estudo para Concursos Públicos.
      
      TAREFA:
      Analise TODOS os documentos anexos (pode haver mais de um) e extraia os conceitos mais importantes, prazos, leis e exceções para criar flashcards de revisão (Active Recall).
      Consolide o conhecimento de todos os arquivos em uma única lista de revisão.
      
      FORMATO DE RESPOSTA OBRIGATÓRIO:
      Retorne APENAS um Array JSON puro. Sem formatação Markdown. Sem \`\`\`json.
      
      SCHEMA:
      [
        { "question": "Pergunta objetiva?", "answer": "Resposta clara e concisa." },
        { "question": "Defina X.", "answer": "X é ..." }
      ]
      
      Gere entre 10 a 20 cards de alta qualidade focados no conteúdo dos documentos.
    `;

    // 4. Chamada à API
    // Payload Order: Text Prompt FIRST, then File Parts (conforme solicitado)
    console.log("[FlashcardGenerator] Enviando requisição para API...");
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: {
        parts: [
            { text: prompt },
            ...fileParts
        ]
      },
      config: {
        responseMimeType: "application/json", // Força modo JSON
        temperature: 0.3,
      }
    });

    console.log("[FlashcardGenerator] Resposta bruta recebida da API.");

    // 5. Tratamento e Limpeza da Resposta
    const textResponse = response.text;
    
    if (!textResponse) {
      throw new Error("A IA retornou uma resposta vazia (null/undefined).");
    }

    // Regex robusto para remover qualquer bloco de código markdown que o modelo possa ter alucinado
    const cleanJson = textResponse
        .replace(/```json/gi, "") // Remove abertura ```json
        .replace(/```/g, "")      // Remove fechamento ```
        .trim();                  // Remove espaços extras

    let rawCards: AIFlashcardResult[] = [];
    
    try {
      rawCards = JSON.parse(cleanJson);
      
      if (!Array.isArray(rawCards)) {
        // Tenta encontrar um array dentro do objeto se não for raiz
        // @ts-expect-error - rawCards might be an object with a cards property
        if (rawCards.cards && Array.isArray(rawCards.cards)) {
            // @ts-expect-error - reassigning to a property of the object
            rawCards = rawCards.cards;
        } else {
            throw new Error("O JSON retornado não é um array de cards.");
        }
      }
    } catch (parseError) {
      console.error("[FlashcardGenerator] JSON Inválido recebido:", cleanJson, parseError);
      throw new Error("A IA gerou um texto que não é um JSON válido. Tente novamente.");
    }

    console.log(`[FlashcardGenerator] Sucesso! ${rawCards.length} cards gerados.`);

    // 6. Mapeamento final
    const processedCards: Flashcard[] = rawCards.map((card, index) => ({
      id: `ai-${Date.now()}-${index}`,
      front: card.question,
      back: card.answer
    }));

    return processedCards;

  } catch (error) {
    const err = error as Error;
    console.error("[FlashcardGenerator] ERRO DETALHADO:", err);
    
    const msg = err.message || err.toString();
    
    if (msg.includes("404") || msg.includes("Not Found")) {
      throw new Error(`Erro 404 (Modelo não encontrado ou Key inválida). Key usada: ${maskedKey}. Verifique se a API Key tem permissão para 'gemini-3-flash-preview'.`);
    }

    if (msg.includes("403") || msg.includes("Permission denied")) {
        throw new Error("Erro 403: Sua API Key não tem permissão ou quota excedida.");
    }

    throw new Error(`Falha na IA: ${msg}`);
  }
}
