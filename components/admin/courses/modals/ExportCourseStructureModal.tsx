import React, { useState, useEffect } from 'react';
import { X, Copy, Code, Check, Loader2 } from 'lucide-react';
import { OnlineCourse, CourseStructureModule, CourseStructureFolder, CourseLesson } from '../../../../types/course';
import { courseService } from '../../../../services/courseService';
import { toast } from 'react-hot-toast';

interface ExportCourseStructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: OnlineCourse;
}

export const ExportCourseStructureModal: React.FC<ExportCourseStructureModalProps> = ({ isOpen, onClose, course }) => {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [structure, setStructure] = useState<CourseStructureModule[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadStructure();
    }
  }, [isOpen]);

  const loadStructure = async () => {
    setLoading(true);
    try {
      const data = await courseService.getCourseStructure(course.id);
      setStructure(data);
    } catch (error) {
      console.error("Erro ao carregar estrutura do curso:", error);
      toast.error("Erro ao carregar estrutura do curso");
    } finally {
      setLoading(false);
    }
  };

  const generateHtml = () => {
    const countModuleLessons = (mod: CourseStructureModule): number => {
      let count = mod.looseLessons?.length || 0;
      
      const countFolderLessons = (folders: CourseStructureFolder[]): number => {
        let folderCount = 0;
        folders.forEach(f => {
          folderCount += f.lessons?.length || 0;
          if (f.subfolders) {
            folderCount += countFolderLessons(f.subfolders);
          }
        });
        return folderCount;
      };

      count += countFolderLessons(mod.folders || []);
      return count;
    };

    const renderLessons = (lessons: CourseLesson[]) => {
      if (!lessons || lessons.length === 0) return '';
      return lessons.map(lesson => `
        <div class="insanus-lesson ${lesson.isProduction ? 'is-production' : ''}">
          <div class="insanus-lesson-icon">
            ${lesson.isProduction 
              ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
              : (lesson.type === 'video' 
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33z"/><path d="M9.75 15.02l5.75-3.27-5.75-3.27v6.54z"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>')
            }
          </div>
          <div class="insanus-lesson-text">
            <span class="insanus-lesson-title">${lesson.title}</span>
            ${lesson.isProduction ? '<span class="insanus-lesson-status">CONTEÚDO EM PRODUÇÃO</span>' : ''}
          </div>
        </div>
      `).join('');
    };

    const renderFolders = (folders: CourseStructureFolder[]): string => {
      if (!folders || folders.length === 0) return '';
      return folders.map(folder => {
        const isRecording = folder.status === 'recording' || folder.isRecording || folder.title.toUpperCase().includes('EM GRAVAÇÃO');
        
        return `
        <div class="insanus-folder ${isRecording ? 'is-recording' : ''}">
          <div class="insanus-folder-header" onclick="${isRecording ? '' : 'this.parentElement.classList.toggle(\'active\')'}">
            <div class="insanus-folder-title">
              <div class="insanus-folder-icon-wrapper">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="insanus-folder-icon"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                ${isRecording ? `
                  <div class="insanus-lock-badge">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/></svg>
                  </div>
                ` : ''}
              </div>
              <div class="insanus-folder-text">
                <span class="insanus-folder-name">${folder.title}</span>
                ${isRecording ? '<span class="insanus-recording-label">CONTEÚDO EM GRAVAÇÃO</span>' : ''}
              </div>
            </div>
            ${isRecording ? '' : '<div class="insanus-arrow"></div>'}
          </div>
          ${isRecording ? '' : `
            <div class="insanus-folder-content">
              ${renderLessons(folder.lessons)}
              ${renderFolders(folder.subfolders || [])}
            </div>
          `}
        </div>
      `;
      }).join('');
    };

    const html = `
<div id="insanus-course-structure" class="insanus-container">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
    
    #insanus-course-structure {
      font-family: 'Inter', sans-serif;
      color: #ffffff;
      background: #0a0a0a;
      padding: 40px 20px;
      border-radius: 20px;
      overflow: hidden;
      max-width: 1200px;
      margin: 0 auto;
    }

    .insanus-grid {
      display: flex;
      overflow-x: auto;
      gap: 20px;
      margin-top: 30px;
      padding-bottom: 20px;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: #ef4444 #1a1d24;
    }

    .insanus-grid::-webkit-scrollbar {
      height: 6px;
    }

    .insanus-grid::-webkit-scrollbar-thumb {
      background: #ef4444;
      border-radius: 10px;
    }

    .insanus-grid::-webkit-scrollbar-track {
      background: #1a1d24;
      border-radius: 10px;
    }

    @media (max-width: 640px) {
      .insanus-grid {
        gap: 12px;
      }
    }

    .insanus-card {
      flex: 0 0 220px;
      scroll-snap-align: start;
      position: relative;
      aspect-ratio: 474/1000;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #2d2f36;
      cursor: pointer;
      transition: all 0.3s ease;
      background: #1a1d24;
    }

    @media (max-width: 640px) {
      .insanus-card {
        flex: 0 0 160px;
      }
    }

    .insanus-card:hover {
      transform: translateY(-5px);
      border-color: #ef4444;
      box-shadow: 0 10px 20px rgba(0,0,0,0.5);
    }

    .insanus-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.5s ease;
    }

    .insanus-card:hover img {
      transform: scale(1.05);
    }

    .insanus-card-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.2) 60%, transparent 100%);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 15px;
      opacity: 0.9;
    }

    .insanus-card-title {
      font-size: 13px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      color: #ffffff;
    }

    .insanus-card-meta {
      font-size: 10px;
      font-weight: 700;
      color: #ef4444;
      display: flex;
      align-items: center;
      gap: 5px;
      text-transform: uppercase;
    }

    /* Modal Style Structure View */
    .insanus-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      backdrop-filter: blur(8px);
      z-index: 99999;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .insanus-modal-overlay.active {
      display: flex;
    }

    .insanus-modal-content {
      background: #121418;
      width: 100%;
      max-width: 600px;
      max-height: 85vh;
      border-radius: 20px;
      border: 1px solid #2d2f36;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: insanus-zoom 0.3s ease-out;
    }

    @keyframes insanus-zoom {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .insanus-modal-header {
      padding: 20px;
      border-bottom: 1px solid #2d2f36;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1a1d24;
    }

    .insanus-modal-title {
      font-weight: 900;
      text-transform: uppercase;
      font-size: 16px;
      color: #ef4444;
    }

    .insanus-close {
      cursor: pointer;
      color: #6b7280;
      transition: color 0.2s;
    }

    .insanus-close:hover {
      color: #ffffff;
    }

    .insanus-modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      scrollbar-width: thin;
      scrollbar-color: #ef4444 #121418;
    }

    .insanus-modal-body::-webkit-scrollbar {
      width: 6px;
    }

    .insanus-modal-body::-webkit-scrollbar-thumb {
      background: #ef4444;
      border-radius: 10px;
    }

    /* Folder and Lesson Styles */
    .insanus-folder {
      margin-bottom: 10px;
      border: 1px solid #2d2f36;
      border-radius: 10px;
      overflow: hidden;
      background: #1a1d24;
    }

    .insanus-folder.is-recording {
      border-color: #3f3f46;
      background: #0f1115;
      opacity: 0.7;
    }

    .insanus-folder-header {
      padding: 12px 15px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background 0.2s;
    }

    .insanus-folder:not(.is-recording) .insanus-folder-header:hover {
      background: #242831;
    }

    .insanus-folder.is-recording .insanus-folder-header {
      cursor: not-allowed;
    }

    .insanus-folder-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 700;
      font-size: 13px;
      text-transform: uppercase;
    }

    .insanus-folder-icon-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .insanus-folder-icon {
      width: 20px;
      height: 20px;
      color: #ef4444;
    }

    .insanus-folder.is-recording .insanus-folder-icon {
      color: #4b5563;
    }

    .insanus-lock-badge {
      position: absolute;
      bottom: -4px;
      right: -4px;
      background: #ef4444;
      color: #ffffff;
      width: 14px;
      height: 14px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px;
      border: 2px solid #0f1115;
    }

    .insanus-folder-text {
      display: flex;
      flex-direction: column;
    }

    .insanus-recording-label {
      font-size: 8px;
      color: #ef4444;
      font-weight: 900;
      margin-top: 2px;
    }

    .insanus-folder-content {
      max-height: 0;
      overflow: hidden;
      background: #0f1115;
      transition: max-height 0.4s ease-in-out;
    }

    .insanus-folder.active .insanus-folder-content {
      max-height: 2000px;
      border-top: 1px solid #2d2f36;
      padding: 10px;
    }

    .insanus-lesson {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 15px;
      border-radius: 8px;
      margin-bottom: 5px;
      background: rgba(255,255,255,0.03);
      border: 1px solid transparent;
      transition: all 0.2s;
    }

    .insanus-lesson:hover {
      background: rgba(255,255,255,0.05);
      border-color: rgba(239, 68, 68, 0.2);
    }

    .insanus-lesson.is-production {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .insanus-lesson-text {
      display: flex;
      flex-direction: column;
    }

    .insanus-lesson-status {
      font-size: 8px;
      color: #ef4444;
      font-weight: 900;
      margin-top: 2px;
    }

    .insanus-lesson-icon {
      width: 16px;
      height: 16px;
      color: #6b7280;
    }

    .insanus-lesson-title {
      font-size: 12px;
      color: #d1d5db;
    }

    .insanus-arrow {
      width: 8px;
      height: 8px;
      border-right: 2px solid #6b7280;
      border-bottom: 2px solid #6b7280;
      transform: rotate(45deg);
      transition: transform 0.3s;
    }

    .insanus-folder.active .insanus-arrow {
      transform: rotate(-135deg);
    }
    
    .insanus-empty {
      text-align: center;
      padding: 30px;
      color: #4b5563;
      font-size: 13px;
    }
  </style>

  <h2 style="text-align: center; text-transform: uppercase; font-weight: 900; letter-spacing: -1px;">${course.title}</h2>
  <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: -10px;">Explore o conteúdo programático do curso</p>

  <div class="insanus-grid">
    ${structure.map((mod, idx) => {
      const lessonCount = countModuleLessons(mod);
      return `
      <div class="insanus-card" onclick="insanusOpenModal('insanus-mod-${idx}')">
        <img src="${mod.coverUrl}" alt="${mod.title}">
        <div class="insanus-card-overlay">
          <div class="insanus-card-title">${mod.title}</div>
          <div class="insanus-card-meta">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33z"/><path d="M9.75 15.02l5.75-3.27-5.75-3.27v6.54z"/></svg>
            ${lessonCount} ${lessonCount === 1 ? 'Aula' : 'Aulas'}
          </div>
        </div>
      </div>
      `;
    }).join('')}
  </div>

  <!-- Modals -->
  ${structure.map((mod, idx) => `
    <div id="insanus-mod-${idx}" class="insanus-modal-overlay" onclick="if(event.target === this) insanusCloseModal('insanus-mod-${idx}')">
      <div class="insanus-modal-content">
        <div class="insanus-modal-header">
          <div class="insanus-modal-title">${mod.title}</div>
          <div class="insanus-close" onclick="insanusCloseModal('insanus-mod-${idx}')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </div>
        </div>
        <div class="insanus-modal-body">
          ${renderLessons(mod.looseLessons)}
          ${renderFolders(mod.folders)}
          ${(mod.looseLessons.length === 0 && mod.folders.length === 0) ? '<div class="insanus-empty">Nenhum conteúdo disponível neste módulo.</div>' : ''}
        </div>
      </div>
    </div>
  `).join('')}

  <script>
    function insanusOpenModal(id) {
      document.getElementById(id).classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    function insanusCloseModal(id) {
      document.getElementById(id).classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  </script>
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
              <Code size={24} className="text-red-500" />
              Exportar Estrutura do Curso (HTML)
            </h3>
            <p className="text-xs text-zinc-500 mt-1">Gere o código HTML dos cards e aulas para suas páginas de vendas.</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-zinc-800">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col gap-4">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-500">
              <Loader2 className="animate-spin text-red-500" size={40} />
              <p className="text-sm font-bold uppercase tracking-widest">Processando estrutura completa...</p>
            </div>
          ) : (
            <>
              <div className="flex-1 bg-black rounded-xl border border-zinc-800 p-4 font-mono text-[11px] text-zinc-400 overflow-auto custom-scrollbar relative group">
                <pre className="whitespace-pre-wrap">{generateHtml()}</pre>
                
                <button 
                  onClick={handleCopy}
                  className="absolute top-4 right-4 p-3 bg-zinc-800 hover:bg-red-600 text-white rounded-xl transition-all shadow-xl flex items-center gap-2 font-bold uppercase tracking-widest text-[10px]"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado!' : 'Copiar Código'}
                </button>
              </div>

              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1">O que está incluso:</p>
                <p className="text-xs text-zinc-400">
                  Este código gera uma grade de cards verticais (conforme a imagem do curso). Ao clicar no card, abre um modal elegante com toda a estrutura de pastas e aulas. Totalmente responsivo para Desktop e Mobile.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-900 bg-zinc-900/50 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose} 
            className="px-6 py-3 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
          >
            Fechar
          </button>
          {!loading && (
            <button 
              onClick={handleCopy}
              className="px-10 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-900/20 transition-all"
            >
              <Copy size={16} /> Copiar HTML Completo
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
