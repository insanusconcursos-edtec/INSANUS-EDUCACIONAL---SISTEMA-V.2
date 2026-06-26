import React, { useState } from 'react';
import { X, Copy, Code, Check } from 'lucide-react';
import { CourseEditalDiscipline, CourseEditalTopic } from '../../../../types/courseEdital';
import { toast } from 'react-hot-toast';

interface ExportEditalModalProps {
  isOpen: boolean;
  onClose: () => void;
  disciplines: CourseEditalDiscipline[];
}

export const ExportEditalModal: React.FC<ExportEditalModalProps> = ({ isOpen, onClose, disciplines }) => {
  const [copied, setCopied] = useState(false);

  const generateHtml = () => {
    const renderTopics = (topics: CourseEditalTopic[], prefix: string = ''): string => {
      if (!topics || topics.length === 0) return '';

      return topics.map((topic, idx) => {
        const currentNumber = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
        const hasSubtopics = topic.subtopics && topic.subtopics.length > 0;
        const isProduction = topic.status === 'EM_PRODUCAO';
        const isRecording = topic.status === 'AULAS_EM_GRAVACAO';
        
        const lawPdfs = (topic.materialPdfs || []).filter(p => p.pdfType === 'LEI_SECA');
        const normalPdfs = (topic.materialPdfs || []).filter(p => p.pdfType !== 'LEI_SECA');
        
        const hasAnyContent = hasSubtopics || isRecording || (topic.materialPdfs && topic.materialPdfs.length > 0);
        
        return `
      <div class="insanus-topic ${hasAnyContent ? 'has-content' : ''} ${hasSubtopics ? 'has-subtopics' : ''}">
        <div class="insanus-topic-header" ${hasAnyContent ? `onclick="event.stopPropagation(); this.parentElement.classList.toggle('active')"` : ''}>
          <div class="insanus-topic-title">
            <span class="insanus-enumeration">${currentNumber}</span>
            <div class="insanus-topic-name-wrapper">
                ${topic.name}
                ${isProduction ? '<svg class="insanus-status-icon lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' : ''}
                ${isRecording ? '<svg class="insanus-status-icon recording" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>' : ''}
            </div>
          </div>
          ${hasAnyContent ? '<div class="insanus-arrow"></div>' : ''}
        </div>
        ${hasAnyContent ? `
        <div class="insanus-topic-content">
          ${isRecording ? '<div class="insanus-recording-notice">AULAS EM GRAVAÇÃO</div>' : ''}
          
          ${lawPdfs.length > 0 ? `
            <div class="insanus-law-section">
                <div class="insanus-section-title">LEI SECA (DOWNLOAD PDF)</div>
                <div class="insanus-pdf-list">
                    ${lawPdfs.map(p => `
                        <a href="${p.url}" target="_blank" class="insanus-pdf-item law">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            ${p.title}
                        </a>
                    `).join('')}
                </div>
            </div>
          ` : ''}

          ${normalPdfs.length > 0 ? `
            <div class="insanus-pdf-section">
                <div class="insanus-pdf-list">
                    ${normalPdfs.map(p => `
                        <a href="${p.url}" target="_blank" class="insanus-pdf-item">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            ${p.title}
                        </a>
                    `).join('')}
                </div>
            </div>
          ` : ''}

          ${renderTopics(topic.subtopics, currentNumber)}
        </div>
        ` : ''}
      </div>`;
      }).join('');
    };

    const renderGroups = (discipline: CourseEditalDiscipline): string => {
      const groups = discipline.topicGroups || [];
      const topics = discipline.topics || [];
      
      let html = '';

      // 1. Renderizar Grupos
      groups.sort((a, b) => a.order - b.order).forEach(group => {
        const groupTopics = topics.filter(t => t.groupId === group.id);
        if (groupTopics.length > 0) {
          html += `
        <div class="insanus-group">
          <div class="insanus-group-header" onclick="event.stopPropagation(); this.parentElement.classList.toggle('active')">
            <div class="insanus-group-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="insanus-group-icon"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              ${group.name}
              <span class="insanus-group-badge">${groupTopics.length} Tópicos</span>
            </div>
            <div class="insanus-arrow"></div>
          </div>
          <div class="insanus-group-content">
            ${renderTopics(groupTopics)}
          </div>
        </div>`;
        }
      });

      // 2. Renderizar Tópicos sem Grupo
      const unassignedTopics = topics.filter(t => !t.groupId);
      if (unassignedTopics.length > 0) {
        if (groups.length > 0) {
          html += '<div class="insanus-separator">Outros Tópicos</div>';
        }
        html += renderTopics(unassignedTopics);
      }

      return html;
    };

    const html = `
<div id="insanus-edital-verticalizado" class="insanus-edital-container">
  <style>
    #insanus-edital-verticalizado.insanus-edital-container {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #ffffff;
      max-width: 100%;
      margin: 0 auto;
      background: transparent;
      text-align: left;
    }
    .insanus-discipline {
      margin-bottom: 12px;
      border: 1px solid #2d2f36;
      border-radius: 12px;
      overflow: hidden;
      background: #1a1d24;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .insanus-discipline-header {
      padding: 16px 20px;
      background: #1a1d24;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
      transition: all 0.3s ease;
    }
    .insanus-discipline-header:hover {
      background: #242831;
    }
    .insanus-discipline-title {
      font-size: 14px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 12px;
      color: #ffffff;
    }
    .insanus-discipline-icon {
      color: #ef4444;
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }
    .insanus-discipline-content {
      max-height: 0;
      overflow: hidden;
      background: #121418;
      transition: max-height 0.5s cubic-bezier(0, 1, 0, 1);
    }
    .insanus-discipline.active .insanus-discipline-content {
      max-height: 10000px;
      transition: max-height 1.5s ease-in-out;
      border-top: 1px solid #2d2f36;
      padding: 12px;
    }
    
    /* Grupos/Pastas */
    .insanus-group {
      margin-bottom: 12px;
      border-left: 3px solid #ef4444;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 0 8px 8px 0;
      overflow: hidden;
    }
    .insanus-group-header {
      padding: 12px 16px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background 0.2s;
    }
    .insanus-group-header:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    .insanus-group-title {
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      color: #ef4444;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .insanus-group-icon {
      flex-shrink: 0;
    }
    .insanus-group-badge {
      font-size: 9px;
      background: rgba(239, 68, 68, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
      margin-left: 10px;
      color: #9ca3af;
    }
    .insanus-group-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.5s cubic-bezier(0, 1, 0, 1);
    }
    .insanus-group.active .insanus-group-content {
      max-height: 5000px;
      transition: max-height 1s ease-in-out;
      padding: 10px;
      border-top: 1px solid rgba(239, 68, 68, 0.1);
    }
    .insanus-separator {
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      color: #4b5563;
      letter-spacing: 1px;
      margin: 20px 0 10px 10px;
      border-bottom: 1px solid #2d2f36;
      padding-bottom: 5px;
    }

    .insanus-topic {
      margin-bottom: 8px;
      border: 1px solid #2d2f36;
      border-radius: 8px;
      background: #1a1d24;
      overflow: hidden;
    }
    .insanus-topic-header {
      padding: 12px 16px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background 0.2s;
    }
    .insanus-topic-header:hover {
      background: #242831;
    }
    .insanus-topic-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      color: #e5e7eb;
    }
    .insanus-topic-content {
      max-height: 0;
      overflow: hidden;
      background: #0f1115;
      transition: max-height 0.5s cubic-bezier(0, 1, 0, 1);
    }
    .insanus-topic.active .insanus-topic-content {
      max-height: 2000px;
      transition: max-height 0.8s ease-in-out;
      border-top: 1px solid #2d2f36;
      padding: 12px 12px 12px 24px;
    }
    .insanus-topic:not(.has-content) {
      background: rgba(26, 29, 36, 0.5);
    }
    .insanus-topic:not(.has-content) .insanus-topic-header {
      cursor: default;
    }
    .insanus-topic:not(.has-content) .insanus-topic-header:hover {
      background: transparent;
    }

    /* Status Icons */
    .insanus-topic-name-wrapper {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .insanus-status-icon {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }
    .insanus-status-icon.lock { color: #ef4444; }
    .insanus-status-icon.recording { color: #3b82f6; }

    /* Notices and Sections */
    .insanus-recording-notice {
      background: rgba(59, 130, 246, 0.1);
      color: #3b82f6;
      font-size: 10px;
      font-weight: 900;
      padding: 8px;
      border-radius: 6px;
      margin-bottom: 12px;
      text-align: center;
      border: 1px dashed rgba(59, 130, 246, 0.3);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .insanus-law-section {
      margin-bottom: 15px;
      padding: 12px;
      background: rgba(59, 130, 246, 0.05);
      border-radius: 8px;
      border: 1px solid rgba(59, 130, 246, 0.1);
    }
    .insanus-pdf-section {
      margin-bottom: 15px;
    }
    .insanus-section-title {
      font-size: 9px;
      font-weight: 900;
      color: #3b82f6;
      margin-bottom: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .insanus-pdf-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .insanus-pdf-item {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #242831;
      border: 1px solid #2d2f36;
      padding: 8px 12px;
      border-radius: 6px;
      color: #d1d5db;
      text-decoration: none;
      font-size: 11px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .insanus-pdf-item:hover {
      background: #2d333f;
      border-color: #ef4444;
      color: #ffffff;
    }
    .insanus-pdf-item.law {
      background: rgba(59, 130, 246, 0.1);
      border-color: rgba(59, 130, 246, 0.2);
    }
    .insanus-pdf-item.law:hover {
      background: rgba(59, 130, 246, 0.2);
      border-color: #3b82f6;
    }

    .insanus-arrow {
      width: 8px;
      height: 8px;
      border-right: 2px solid #6b7280;
      border-bottom: 2px solid #6b7280;
      transform: rotate(45deg);
      transition: transform 0.3s;
      margin-right: 4px;
      flex-shrink: 0;
    }
    .insanus-discipline.active > .insanus-discipline-header .insanus-arrow,
    .insanus-group.active > .insanus-group-header .insanus-arrow,
    .insanus-topic.active > .insanus-topic-header .insanus-arrow {
      transform: rotate(-135deg);
    }
    .insanus-enumeration {
      color: #ef4444;
      font-weight: 900;
      font-size: 11px;
      min-width: 24px;
      display: inline-block;
    }
  </style>

  ${disciplines.map((discipline) => `
  <div class="insanus-discipline">
    <div class="insanus-discipline-header" onclick="this.parentElement.classList.toggle('active')">
      <div class="insanus-discipline-title">
        <span class="insanus-discipline-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
        </span>
        ${discipline.name}
      </div>
      <div class="insanus-arrow"></div>
    </div>
    <div class="insanus-discipline-content">
      ${renderGroups(discipline)}
    </div>
  </div>
  `).join('')}
</div>
    `;
    return html.trim();
  };

  const handleCopy = () => {
    const html = generateHtml();
    navigator.clipboard.writeText(html);
    setCopied(true);
    toast.success('Código HTML copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-900 bg-zinc-900/50 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
              <Code size={24} className="text-orange-500" />
              Exportar Edital (HTML)
            </h3>
            <p className="text-xs text-zinc-500 mt-1">Gere o código HTML para usar em suas páginas de vendas.</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-zinc-800">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col gap-4">
          <div className="flex-1 bg-black rounded-xl border border-zinc-800 p-4 font-mono text-[11px] text-zinc-400 overflow-auto custom-scrollbar relative group">
            <pre className="whitespace-pre-wrap">{generateHtml()}</pre>
            
            <button 
              onClick={handleCopy}
              className="absolute top-4 right-4 p-3 bg-zinc-800 hover:bg-orange-600 text-white rounded-xl transition-all shadow-xl flex items-center gap-2 font-bold uppercase tracking-widest text-[10px]"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copiado!' : 'Copiar Código'}
            </button>
          </div>

          <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
            <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider mb-1">Dica de Uso:</p>
            <p className="text-xs text-zinc-400">
              Copie o código acima e cole em um bloco de &quot;HTML Personalizado&quot; ou &quot;Código&quot; na sua ferramenta de criação de páginas (Elementor, Clickpages, Hotmart Pages, etc). O estilo e comportamento do acordeão já estão inclusos no código.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-900 bg-zinc-900/50 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose} 
            className="px-6 py-3 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
          >
            Fechar
          </button>
          <button 
            onClick={handleCopy}
            className="px-10 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-900/20 transition-all"
          >
            <Copy size={16} /> Copiar HTML Completo
          </button>
        </div>
      </div>
    </div>
  );
};
