
import React, { useState, useEffect } from 'react';
import { FileText, FileQuestion, Layers, Download } from 'lucide-react';
import { CourseLesson, CourseContent } from '../../../../types/course';
import { courseService } from '../../../../services/courseService';
import { useAuth } from '../../../../contexts/AuthContext';
import { openWatermarkedPdf } from '../../../../utils/pdfSecurityService';
import { AlternativeYouTubePlayer } from '../../../shared/AlternativeYouTubePlayer';

interface CoursePlayerContentProps {
  lesson: CourseLesson;
}

export function CoursePlayerContent({ lesson }: CoursePlayerContentProps) {
  const { currentUser, userData } = useAuth();
  const [contents, setContents] = useState<CourseContent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para controlar o loading específico de cada PDF
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null);

  useEffect(() => {
    const loadContents = async () => {
        setLoading(true);
        try {
            const data = await courseService.getContents(lesson.id);
            setContents(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };
    loadContents();
  }, [lesson.id]);

  // Função para abrir PDF com marca d'água
  const handleOpenPdf = async (url: string, contentId: string) => {
    if (!url || !currentUser) return;
    if (openingPdfId) return; // Evita múltiplos cliques

    setOpeningPdfId(contentId);

    try {
        await openWatermarkedPdf(url, {
            email: currentUser.email || 'usuario@insanus.com',
            cpf: userData?.cpf || '000.000.000-00'
        });
    } catch (error: any) {
        console.error("Erro ao abrir PDF:", error);
        alert(`Erro ao gerar documento seguro: ${error.message}`);
    } finally {
        setOpeningPdfId(null);
    }
  };

  // Helper para o YouTube
  function getYouTubeID(url: string) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div></div>;

  if (contents.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <p>Esta aula ainda não possui conteúdo.</p>
          </div>
      );
  }

  return (
    <div className="w-full flex flex-col animate-in fade-in">
        
        {contents.map((item, index) => {
            
            // --- BLOCO DE VÍDEO ---
            if (item.type === 'video') {
                return (
                    <div key={item.id} className="w-full bg-[#0a0c10] border-b border-gray-900 shadow-2xl relative z-10 py-6 md:py-10 px-4 md:px-10">
                        <div className="w-full max-w-4xl aspect-video mx-auto rounded-xl overflow-hidden border border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.5)]"> 
                            {item.videoPlatform === 'youtube' ? (
                                <div className="w-full h-full bg-black">
                                    <AlternativeYouTubePlayer videoId={getYouTubeID(item.videoUrl || '') || ''} />
                                </div>
                            ) : (
                                <iframe src={item.videoUrl} className="w-full h-full" frameBorder="0" allowFullScreen />
                            )}
                        </div>
                    </div>
                );
            }

            // --- OUTROS CONTEÚDOS ---
            return (
                <div key={item.id} className="w-full max-w-6xl mx-auto px-6 lg:px-10 mt-8">
                    
                    {/* Exibe o Título da Aula apenas acima do primeiro conteúdo não-vídeo */}
                    {((index === 0 && item.type !== 'video') || (index === 1 && contents[0].type === 'video')) && (
                         <div className="border-b border-gray-800 pb-4 mb-6">
                            <h1 className="text-2xl font-bold text-white">{lesson.title}</h1>
                        </div>
                    )}

                    {/* Texto Rico */}
                    {item.type === 'text' && (
                        <div className="prose prose-invert max-w-none bg-[#1a1d24] p-6 rounded-xl border border-gray-800" dangerouslySetInnerHTML={{ __html: item.textContent || '' }} />
                    )}

                    {/* PDF (COM SEGURANÇA) */}
                    {item.type === 'pdf' && (() => {
                        const getMaterialStyles = (classification?: string) => {
                            const upperClass = classification?.toUpperCase();
                            switch (upperClass) {
                                case 'TEORIA':
                                    return {
                                        Icon: FileText,
                                        colorClass: 'text-yellow-500',
                                        borderClass: 'border-yellow-500/20',
                                        bgClass: 'bg-yellow-500/10'
                                    };
                                case 'QUESTÕES':
                                    return {
                                        Icon: FileQuestion,
                                        colorClass: 'text-orange-500',
                                        borderClass: 'border-orange-500/20',
                                        bgClass: 'bg-orange-500/10'
                                    };
                                case 'TEORIA_QUESTÕES':
                                case 'AMBOS':
                                case 'HÍBRIDO':
                                    return {
                                        Icon: Layers,
                                        colorClass: 'text-blue-500',
                                        borderClass: 'border-blue-500/20',
                                        bgClass: 'bg-blue-500/10'
                                    };
                                default:
                                    // Default para Teoria se não houver classificação
                                    return {
                                        Icon: FileText,
                                        colorClass: 'text-yellow-500',
                                        borderClass: 'border-yellow-500/20',
                                        bgClass: 'bg-yellow-500/10'
                                    };
                            }
                        };

                        const styles = getMaterialStyles(item.pdfClassification);
                        const isLinked = item.isLinkedToPreviousTheory;

                        return (
                            <div className={`relative ${isLinked ? 'ml-16' : ''}`}>
                                {isLinked && (
                                    <div className="absolute -left-8 top-0 w-8 h-1/2 border-l-2 border-b-2 border-orange-500/30 rounded-bl-lg"></div>
                                )}
                                <div 
                                    onClick={() => handleOpenPdf(item.fileUrl || '', item.id)}
                                    className={`
                                        flex items-center gap-4 p-4 bg-[#1a1d24] border ${styles.borderClass} rounded-xl transition-all group mb-4 cursor-pointer
                                        ${openingPdfId === item.id ? 'opacity-75 pointer-events-none' : `hover:border-red-600/50 hover:bg-[#202329]` }
                                    `}
                                >
                                    <div className={`w-10 h-10 rounded ${styles.bgClass} flex items-center justify-center ${styles.colorClass} group-hover:scale-110 transition-transform shrink-0`}>
                                        {openingPdfId === item.id ? (
                                            <div className={`animate-spin h-5 w-5 border-2 ${styles.colorClass} border-t-transparent rounded-full`}></div>
                                        ) : (
                                            <styles.Icon size={24} />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-white font-bold text-sm">{item.title}</h4>
                                        <span className={`text-[10px] uppercase transition-colors ${openingPdfId === item.id ? 'text-red-400 animate-pulse' : 'text-gray-500 group-hover:text-gray-400'}`}>
                                            {openingPdfId === item.id ? 'Gerando documento seguro...' : `Material em PDF • ${item.pdfClassification || 'TEORIA'} • Clique para acessar`}
                                        </span>
                                    </div>
                                    {openingPdfId !== item.id && (
                                        <Download className="w-5 h-5 text-gray-500 group-hover:text-white" />
                                    )}
                                </div>

                                {/* Gabarito Comentado (se houver) */}
                                {item.commentedAnswerKeyUrl && (
                                    <div className="relative ml-16 mt-2">
                                        <div className="absolute -left-8 top-0 w-8 h-1/2 border-l-2 border-b-2 border-blue-500/30 rounded-bl-lg"></div>
                                        <div 
                                            onClick={() => handleOpenPdf(item.commentedAnswerKeyUrl!, `${item.id}-answerkey`)}
                                            className={`
                                                flex items-center gap-3 p-3 bg-blue-900/5 border border-blue-500/20 rounded-xl transition-all group mb-4 cursor-pointer
                                                ${openingPdfId === `${item.id}-answerkey` ? 'opacity-75 pointer-events-none' : `hover:border-blue-500/50 hover:bg-blue-900/10` }
                                            `}
                                        >
                                            <div className={`w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform shrink-0`}>
                                                {openingPdfId === `${item.id}-answerkey` ? (
                                                    <div className={`animate-spin h-4 w-4 border-2 text-blue-500 border-t-transparent rounded-full`}></div>
                                                ) : (
                                                    <FileText size={18} />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-white font-bold text-xs">Gabarito Comentado</h4>
                                                <span className={`text-[9px] uppercase transition-colors ${openingPdfId === `${item.id}-answerkey` ? 'text-blue-400 animate-pulse' : 'text-gray-500 group-hover:text-gray-400'}`}>
                                                    {openingPdfId === `${item.id}-answerkey` ? 'Gerando documento seguro...' : `Material Complementar • Clique para acessar`}
                                                </span>
                                            </div>
                                            {openingPdfId !== `${item.id}-answerkey` && (
                                                <Download className="w-4 h-4 text-gray-500 group-hover:text-white" />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Link */}
                    {item.type === 'link' && (
                        <a href={item.linkUrl} target="_blank" rel="noreferrer" className="flex items-center gap-4 p-4 bg-[#1a1d24] border border-gray-800 rounded-xl hover:border-blue-500/50 hover:bg-[#202329] transition-all group mb-4">
                            <div className="w-10 h-10 rounded bg-blue-900/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform shrink-0">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            </div>
                            <div className="flex-1">
                                <h4 className="text-white font-bold text-sm">{item.title}</h4>
                                <span className="text-[10px] text-gray-500 uppercase">Link Externo</span>
                            </div>
                        </a>
                    )}

                    {/* Embed */}
                    {item.type === 'embed' && (
                        <div className="w-full overflow-hidden rounded-xl border border-gray-800 mb-4" dangerouslySetInnerHTML={{ __html: item.embedCode || '' }} />
                    )}
                </div>
            );
        })}
    </div>
  );
}
