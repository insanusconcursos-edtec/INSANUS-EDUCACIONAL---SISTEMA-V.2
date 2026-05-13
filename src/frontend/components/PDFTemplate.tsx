
import React from 'react';
import ReactMarkdown from 'react-markdown';

interface PDFTemplateProps {
  markdownText: string;
  disciplinaName: string;
  disciplinaAssunto: string;
  includeTOC?: boolean;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export const PDFTemplate: React.FC<PDFTemplateProps> = ({ 
  markdownText, 
  disciplinaName, 
  disciplinaAssunto,
  includeTOC = false,
  containerRef
}) => {
  const extractTOC = (text: string) => {
    if (!text) return [];
    // Pega apenas as linhas de títulos geradas pela IA
    return text.split('\n').filter(line => line.match(/^(#{1,4})\s/));
  };
  const tocItems = extractTOC(markdownText);

  return (
    <div id="insanus-pdf-wrapper" style={{ display: 'none' }}>
      <div 
        id="insanus-pdf-container" 
        ref={containerRef}
        style={{ 
          width: '800px', 
          maxWidth: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
          overflowWrap: 'break-word',
          wordWrap: 'break-word',
          minHeight: '297mm', 
          padding: '0', // Removido padding para respeitar as margens exatas do html2pdf
          backgroundColor: '#ffffff', 
          color: '#000000',
          position: 'relative',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1, padding: '10mm 0' }}>
          {/* O Cabeçalho e Rodapé agora são injetados via jsPDF no ModuleContentManager */}

          {/* SUMÁRIO / ÍNDICE (SIMPLIFICADO) */}
          {includeTOC && tocItems.length > 0 && (
            <div style={{ pageBreakAfter: 'always', marginBottom: '20px' }}>
              <h1 style={{ 
                fontFamily: "'Calibri', sans-serif", 
                fontSize: '14pt', 
                textAlign: 'center', 
                fontWeight: 'bold', 
                paddingBottom: '20px',
                textTransform: 'uppercase'
              }}>
                ÍNDICE DO MATERIAL
              </h1>
              <div style={{ padding: '0 20px' }}>
                {tocItems.map((item, index) => {
                  const level = item.match(/^#+/)?.[0].length || 1;
                  const cleanText = item.replace(/^#+\s/, '').replace(/\*/g, '');
                  return (
                    <div key={index} style={{ 
                      marginLeft: `${(level - 1) * 20}px`, 
                      fontFamily: "'Calibri', sans-serif", 
                      fontSize: '12pt', 
                      marginBottom: '10px',
                      color: '#222'
                    }}>
                      {cleanText}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Títulos Iniciais */}
          <div data-pdf-anchor="titles" style={{ marginBottom: '30px' }}>
          <h1 style={{ 
            fontFamily: "'Calibri', sans-serif", 
            fontSize: '14pt', 
            textAlign: 'center', 
            fontWeight: 'bold',
            margin: '0 0 5px 0',
            textTransform: 'uppercase',
            pageBreakAfter: 'avoid',
            breakAfter: 'avoid'
          }}>
            {disciplinaName}
          </h1>
          <h2 style={{ 
            fontFamily: "'Calibri', sans-serif", 
            fontSize: '14pt', 
            textAlign: 'center', 
            fontWeight: 'bold',
            margin: '0',
            pageBreakAfter: 'avoid',
            breakAfter: 'avoid'
          }}>
            {disciplinaAssunto}
          </h2>
        </div>

        {/* Conteúdo Markdown */}
        <div className="markdown-content" style={{ 
          fontFamily: "'Calibri', sans-serif",
          lineHeight: '1.5'
        }}>
          <div className="markdown-body">
            {(() => {
              const formattedMarkdown = markdownText.split('\n').map(line => {
                if (line.includes('🚨') || line.toUpperCase().includes('PEGADINHA')) {
                  // Se a IA não colocou o sinal de citação (>), nós colocamos para forçar a box
                  return line.trim().startsWith('>') ? line : `> ${line}`;
                }
                return line;
              }).join('\n');

              return (
                <ReactMarkdown>
                  {formattedMarkdown}
                </ReactMarkdown>
              );
            })()}
          </div>
        </div>
      </div>
    </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @font-face {
          font-family: 'Squartiqa4FUltralight';
          src: local('Squartiqa4FUltralight'), local('sans-serif');
        }
        #insanus-pdf-container .markdown-body p {
          font-size: 10pt !important;
          text-align: justify !important;
          margin-bottom: 10px !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        #insanus-pdf-container .markdown-body li {
          font-size: 10pt !important;
          text-align: justify !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        #insanus-pdf-container .markdown-body h1,
        #insanus-pdf-container .markdown-body h2,
        #insanus-pdf-container .markdown-body h3,
        #insanus-pdf-container .markdown-body h4,
        #insanus-pdf-container .markdown-body h5,
        #insanus-pdf-container .markdown-body h6 {
          text-align: justify !important;
          font-weight: bold !important;
          page-break-after: avoid !important;
          break-after: avoid !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          padding-bottom: 2px !important;
        }
        #insanus-pdf-container .markdown-body h1, #insanus-pdf-container .markdown-body h2 { 
          font-size: 14pt !important; 
          margin-top: 15px !important; 
          margin-bottom: 10px !important; 
        }
        #insanus-pdf-container .markdown-body h3, #insanus-pdf-container .markdown-body h4 { 
          font-size: 12pt !important; 
          margin-top: 10px !important; 
          margin-bottom: 5px !important; 
        }
        #insanus-pdf-container .markdown-body h5, #insanus-pdf-container .markdown-body h6 { 
          font-size: 11pt !important; 
          margin-top: 10px !important; 
          margin-bottom: 5px !important; 
        }
        #insanus-pdf-container h1,
        #insanus-pdf-container h2,
        #insanus-pdf-container h3,
        #insanus-pdf-container h4,
        #insanus-pdf-container h5,
        #insanus-pdf-container h6 {
          page-break-after: avoid !important;
          break-after: avoid !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          padding-bottom: 2px !important;
        }
        #insanus-pdf-container blockquote {
          border: 2px dashed #e74c3c !important;
          background-color: #fdf2f2 !important;
          padding: 15px !important;
          border-radius: 8px !important;
          margin: 20px 0 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        #insanus-pdf-container blockquote p {
          margin: 0 !important;
          color: #000000 !important;
        }
        #insanus-pdf-container {
          width: 800px !important;
          max-width: 100% !important;
          margin: 0 auto !important;
          background-color: #ffffff !important;
          color: #000000 !important;
        }
        #insanus-pdf-container * {
          background-color: transparent !important;
        }
        #insanus-pdf-container hr {
          margin: 25px 0 !important;
          border: none !important;
          border-top: 1px solid #ccc !important;
        }
        @media print {
          #insanus-pdf-container {
            width: 100%;
            height: auto;
            padding: 0;
            margin: 0;
          }
        }
      `}} />
    </div>
  );
};

export default PDFTemplate;
