import { GoogleGenAI } from "@google/genai";

/**
 * Serviço responsável por transformar transcrições brutas em material didático estruturado
 * utilizando a inteligência artificial do Google Gemini.
 */

const MODEL_NAME = "gemini-3.1-pro-preview";

/**
 * Gera material didático a partir de uma transcrição de vídeo.
 * @param transcriptionText O texto bruto da transcrição (limpo de timestamps)
 * @param folderTitle O título do tópico ou pasta para contexto
 * @returns Material didático formatado em Markdown
 */
export async function generateStudyMaterial(transcriptionText: string, folderTitle: string): Promise<string> {
  const apiKey = process.env.MINHA_CHAVE_GEMINI;

  if (!apiKey) {
    throw new Error("Chave do Gemini (MINHA_CHAVE_GEMINI) não configurada.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
Você é um professor sênior e autoridade máxima em preparação para Concursos Públicos e ENEM.
Sua missão é transformar transcrições de aulas em materiais didáticos de excelência.

REGRAS DE OURO:
1. Aja de forma extremamente didática e organizada.
2. A linguagem adotada deve ser acessível e de fácil entendimento para alunos de todos os níveis.
3. O material DEVE ser estruturado, hierarquizado e enumerado em tópicos e subtópicos claros.
4. Adote exemplos práticos, cotidianos e fáceis de assimilar para ilustrar a teoria.
5. Pense como um examinador de banca de concursos públicos (IDECAN, Cebraspe, FGV, etc.). Identifique as possíveis pegadinhas que as bancas podem elaborar acerca dos tópicos trabalhados.
6. Crie blocos visuais de destaque EXATAMENTE com o texto "🚨 ATENÇÃO - PEGADINHA DE PROVA" apontando como o assunto costuma ser cobrado para induzir o candidato ao erro.
7. Mantenha fidelidade absoluta ao conteúdo que o professor ensinou na transcrição, mas aja proativamente para organizar e polir o raciocínio que, na fala falada, pode ser desestruturado, repetitivo ou confuso.
8. O título principal do material deve ser relacionado ao contexto: "${folderTitle}".
`;

  const prompt = `
Abaixo está a transcrição de uma aula. Por favor, transforme-a em um material didático completo, seguindo rigorosamente as instruções de sistema.

CONTEÚDO DA TRANSCRIÇÃO:
---
${transcriptionText}
---

Gere o material formatado em Markdown.
`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    if (!response.text) {
      throw new Error("O modelo não retornou nenhum conteúdo.");
    }

    return response.text;
  } catch (error) {
    console.error("Erro ao gerar material didático com Gemini:", error);
    throw new Error("Falha na geração do material didático via IA.");
  }
}
