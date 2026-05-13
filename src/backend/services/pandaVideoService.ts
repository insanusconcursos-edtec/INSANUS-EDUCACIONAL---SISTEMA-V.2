/**
 * Panda Video API v2 Service
 * Responsável por extrair transcrições (legendas) dos vídeos hospedados no Panda Video.
 */

/**
 * Limpa o texto de um arquivo VTT removendo metadados e timestamps.
 * @param vttText O conteúdo bruto do arquivo .vtt
 * @returns Texto limpo e contínuo
 */
function cleanVttText(vttText: string): string {
  // Remove o cabeçalho WEBVTT
  let cleaned = vttText.replace(/^WEBVTT.*\n/i, '');

  // Remove timestamps (ex: 00:00:00.000 --> 00:00:05.000)
  // E também remove possíveis metadados de estilo ou posicionamento que seguem o timestamp
  cleaned = cleaned.replace(/\d{2}:\d{2}:\d{2}.\d{3} --> \d{2}:\d{2}:\d{2}.\d{3}.*\n/g, '');

  // Remove linhas vazias e espaços extras
  const lines = cleaned.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.match(/^\d+$/)); // Remove números de sequência se houver (comum em SRT)

  return lines.join(' ');
}

/**
 * Busca a transcrição de um vídeo no Panda Video.
 * @param videoId ID do vídeo no Panda Video
 * @returns Texto da transcrição limpo
 */
export async function fetchPandaVideoTranscription(videoId: string): Promise<string> {
  const apiKey = process.env.PANDA_API_KEY;
  const cleanVideoId = videoId.replace(/[^a-zA-Z0-9-]/g, '');

  console.log(`\n--- BUSCA DE LEGENDA PANDA VIDEO ---`);
  console.log(`ID do Vídeo: [${cleanVideoId}]`);
  console.log(`------------------------------------\n`);

  if (!apiKey) {
    throw new Error('PANDA_API_KEY não configurada no ambiente.');
  }

  try {
    // 1. Busca os metadados da legenda
    const subResponse = await fetch(`https://api-v2.pandavideo.com.br/subtitles/${cleanVideoId}`, {
      method: 'GET',
      headers: { 'Authorization': apiKey, 'Accept': 'application/json' }
    });

    if (!subResponse.ok) return "[Aviso: Este vídeo não possui legendas no Panda Video.]";

    const subData = await subResponse.json();
    const subtitlesList = (subData.subtitles || (Array.isArray(subData) ? subData : [])) as { srclang?: string }[];
    if (!subtitlesList || subtitlesList.length === 0) return "[Aviso: Sem legendas ativas no vídeo.]";

    // 2. Extrai o idioma (ex: 'pt-BR' ou 'en')
    const langCode = subtitlesList[0].srclang || 'pt-BR';

    // 3. Faz o fetch do arquivo real da legenda
    const contentResponse = await fetch(`https://api-v2.pandavideo.com.br/subtitles/${cleanVideoId}/${langCode}`, {
      method: 'GET',
      headers: { 'Authorization': apiKey, 'Accept': 'application/json, text/vtt, */*' }
    });

    if (!contentResponse.ok) return `[Aviso: Falha ao baixar o arquivo de legenda. Status: ${contentResponse.status}]`;

    // 4. Extração infalível (lê como texto bruto primeiro)
    const rawContent = await contentResponse.text();
    let vttText = '';

    try {
      // Tenta interpretar como JSON (para o caso de o Panda mandar um link futuro)
      const contentData = JSON.parse(rawContent);
      const vttUrl = contentData.url || contentData.file || contentData.src || contentData.link;
      
      if (vttUrl) {
        const vttDownload = await fetch(vttUrl);
        vttText = await vttDownload.text();
      } else if (contentData.subtitle || contentData.text) {
        vttText = contentData.subtitle || contentData.text;
      } else {
        console.log("[ERRO PANDA] JSON recebido, mas sem URL:", contentData);
        return "[Aviso: Formato de legenda JSON não reconhecido.]";
      }
    } catch {
      // Se o JSON.parse der erro (SyntaxError: Unexpected token W), é a prova de que o Panda já enviou o VTT puro!
      vttText = rawContent;
    }

    // 5. Limpa e devolve para o Gemini
    return cleanVttText(vttText);

  } catch (error) {
    console.error(`Erro ao extrair legenda do vídeo ${cleanVideoId}:`, error);
    return "[Aviso: Falha na comunicação com o servidor de legendas.]";
  }
}
