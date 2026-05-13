
import { GoogleGenAI } from "@google/genai";

export interface AIMindMapNode {
  id: string;
  label: string;
  children?: AIMindMapNode[];
}

/**
 * Converte arquivo (File) para Base64 limpo para envio Inline
 * Esta abordagem resolve problemas de CORS e 404 ao enviar arquivos locais
 */
export async function fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // O result vem como "data:application/pdf;base64,XYZ..."
      // Pegamos apenas a parte XYZ (Base64 puro)
      const base64Data = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type || "application/pdf",
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Função Principal: Gera a Estrutura do Mapa Mental via IA
 * @param pdfFile Arquivo PDF ou Imagem para análise
 */
export async function generateMindMapStructure(pdfFile: File): Promise<AIMindMapNode> {
  try {
    const apiKey = process.env.API_KEY || '';
    if (!apiKey) {
        console.warn("API Key não encontrada. Verifique seu arquivo .env ou configurações da Vercel.");
    }

    if (!pdfFile) throw new Error("Nenhum arquivo PDF fornecido para a IA.");
    
    // INICIALIZAÇÃO TARDIA (LAZY) - Previne crash no boot da aplicação
    const ai = new GoogleGenAI({ apiKey });

    console.log("1. Preparando arquivo para envio (Base64)...");
    const pdfPart = await fileToGenerativePart(pdfFile);

    const prompt = `
      Você é um Professor Especialista em Concursos Públicos e Didática.
      Tarefa: Analise o conteúdo deste arquivo PDF e crie uma Árvore de Mapa Mental altamente didática.

      REGRA CRÍTICA DE FORMATO:
      Retorne APENAS um objeto JSON válido. Não use blocos de código markdown (\`\`\`json).
      O retorno deve começar com '{' e terminar com '}'.

      ESTRUTURA DO JSON (Recursiva):
      {
        "id": "root",
        "label": "TEMA CENTRAL DO DOCUMENTO",
        "children": [
          {
            "id": "uuid-temp-1",
            "label": "<b>Conceito Principal</b>",
            "children": [
               { 
                 "id": "uuid-temp-2", 
                 "label": "Detalhe curto ou exemplo", 
                 "children": [] 
               }
            ]
          }
        ]
      }

      DIRETRIZES PEDAGÓGICAS:
      1. Seja profundo: O mapa deve ter pelo menos 3 níveis hierárquicos (Tema > Tópico > Detalhe).
      2. Seja sintético: Os textos dos nós (labels) devem ser curtos (máx 8 palavras).
      3. Use formatação: Destaque palavras-chave importantes usando tags <b>negrito</b>.
      4. Foco no conteúdo: Ignore índices, bibliografias ou textos introdutórios irrelevantes.
    `;

    console.log("2. Enviando requisição para Gemini 3 Flash...");
    
    // Usando 'gemini-3-flash-preview' para Basic Text Tasks, ou 'gemini-3-pro-preview' para complexas.
    // Estruturação de mapa mental é uma tarefa de texto.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: {
        parts: [
            pdfPart, 
            { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        temperature: 0.7,
      }
    });

    console.log("3. Resposta da IA recebida.");

    const text = response.text;
    if (!text) throw new Error("A IA retornou uma resposta vazia.");

    // Limpeza de segurança para garantir JSON válido
    const jsonString = text.replace(/```json|```/g, "").trim();
    
    return JSON.parse(jsonString) as AIMindMapNode;

  } catch (error: any) {
    console.error("ERRO NA GERAÇÃO IA:", error);
    
    // Tratamento de erros comuns
    if (error.message?.includes('404')) {
        throw new Error("Modelo não encontrado ou API Key inválida. Verifique se sua chave tem acesso ao 'gemini-3-flash-preview'.");
    }

    throw new Error(`Falha ao gerar mapa: ${error.message}`);
  }
}
