import React, { useState, useEffect } from 'react';
import { mentorshipService } from '../../../services/mentorshipService';
import { MentorshipSection, MentorshipModule } from '../../../types/mentorship';
import { MentorshipRow } from './MentorshipRow';
import { StudentLessonPlayer } from './StudentLessonPlayer'; 

interface StudentMentorshipViewerProps {
  planId: string;
  onActiveModuleChange?: (isActive: boolean) => void;
}

const StudentMentorshipViewer: React.FC<StudentMentorshipViewerProps> = ({ planId, onActiveModuleChange }) => {
  const [sections, setSections] = useState<MentorshipSection[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado de Navegação: Quando preenchido, o Player é ativado
  const [selectedModule, setSelectedModule] = useState<MentorshipModule | null>(null);

  useEffect(() => {
    if (onActiveModuleChange) {
      onActiveModuleChange(!!selectedModule);
    }
  }, [selectedModule, onActiveModuleChange]);

  useEffect(() => {
    if (planId) loadMentorship();
  }, [planId]);

  const loadMentorship = async () => {
    setLoading(true);
    try {
      const data = await mentorshipService.getMentorship(planId);
      if (data && data.sections) {
        // Ordena as seções conforme definido pelo admin
        const sortedSections = [...data.sections].sort((a, b) => (a.order || 0) - (b.order || 0));
        setSections(sortedSections);
      }
    } catch (error) {
      console.error("Erro ao carregar mentoria:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERIZAÇÃO: PLAYER (AMBIENTE DE AULA) ---
  // Se houver um módulo selecionado, renderiza o Player diretamente
  if (selectedModule) {
    return (
      <StudentLessonPlayer 
        module={selectedModule}
        planId={planId}
        onBack={() => setSelectedModule(null)} 
      />
    );
  }

  // --- RENDERIZAÇÃO: VITRINE LIMPA (SEM BANNER) ---
  return (
    <div className="animate-in fade-in">
      
      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--plan-theme)]"></div>
        </div>
      ) : sections.length === 0 ? (
        <div className="text-center py-20 px-4">
            <p className="text-gray-500">Nenhum conteúdo disponível.</p>
        </div>
      ) : (
        /* Lista de Seções com Linhas Horizontais */
        <div className="space-y-2">
            {sections.map(section => (
                <MentorshipRow 
                    key={section.id} 
                    section={section} 
                    onModuleClick={(mod) => setSelectedModule(mod)}
                />
            ))}
        </div>
      )}
    </div>
  );
};

export default StudentMentorshipViewer;