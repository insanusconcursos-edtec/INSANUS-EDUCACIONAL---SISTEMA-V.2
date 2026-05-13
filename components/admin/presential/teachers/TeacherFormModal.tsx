import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Save, CheckCircle } from 'lucide-react';
import { Teacher } from '../../../../types/teacher';
import { teacherService } from '../../../../services/teacherService';
import { BasicInfoForm } from './forms/BasicInfoForm';
import { ProfessionalDataForm } from './forms/ProfessionalDataForm';
import { FinancialForm } from './forms/FinancialForm';
import { TeacherAvailability } from './TeacherAvailability';
import { TeacherBlockDates } from './TeacherBlockDates';

interface TeacherFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  teacherToEdit?: Teacher;
}

const STEPS = [
  { id: 'BASIC', label: 'Básico' },
  { id: 'PROFESSIONAL', label: 'Profissional' },
  { id: 'FINANCIAL', label: 'Financeiro' },
  { id: 'AVAILABILITY', label: 'Disponibilidade' },
  { id: 'BLOCKS', label: 'Bloqueios' },
];

const INITIAL_DATA: Partial<Teacher> = {
  areas: [],
  locations: [],
  subjects: [],
  schedulePreferences: [],
  unavailabilities: [],
  availableWeekends: { saturday: false, sunday: false }
};

export const TeacherFormModal: React.FC<TeacherFormModalProps> = ({ isOpen, onClose, onSuccess, teacherToEdit }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Partial<Teacher>>(INITIAL_DATA);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (teacherToEdit) {
        setFormData(teacherToEdit);
      } else {
        setFormData(INITIAL_DATA);
      }
      setCurrentStep(0);
    }
  }, [isOpen, teacherToEdit]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Basic validation
      if (!formData.name || !formData.email) {
        alert("Nome e Email são obrigatórios.");
        setLoading(false);
        return;
      }

      if (teacherToEdit && teacherToEdit.id) {
        await teacherService.updateTeacher(teacherToEdit.id, formData);
      } else {
        await teacherService.createTeacher(formData as Omit<Teacher, 'id'>);
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving teacher:", error);
      alert("Erro ao salvar professor. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (file: File): Promise<string> => {
    // If we have an ID, use it. If not, we might need to create a temp ID or handle it differently.
    // For simplicity, let's assume we need an ID for the path. 
    // If new teacher, we might upload to a temp folder or just use a timestamp based ID for storage path.
    const tempId = teacherToEdit?.id || `temp_${Date.now()}`;
    return await teacherService.uploadPhoto(file, tempId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-brand-black border border-zinc-800 w-full max-w-4xl h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50">
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            {teacherToEdit ? 'Editar Professor' : 'Novo Professor'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps Progress */}
        <div className="h-14 border-b border-zinc-800 flex items-center px-6 gap-2 overflow-x-auto scrollbar-hide bg-zinc-900/30">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-colors ${
                  index === currentStep 
                    ? 'bg-brand-red text-white shadow-lg shadow-brand-red/20' 
                    : index < currentStep 
                      ? 'bg-zinc-800 text-zinc-400' 
                      : 'text-zinc-600'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[9px]">
                  {index + 1}
                </span>
                {step.label}
              </div>
              {index < STEPS.length - 1 && (
                <div className={`w-8 h-px mx-2 ${index < currentStep ? 'bg-zinc-700' : 'bg-zinc-800'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          <div className="max-w-3xl mx-auto">
            {currentStep === 0 && (
              <BasicInfoForm 
                data={formData} 
                onChange={(updates) => setFormData({ ...formData, ...updates })} 
                onPhotoUpload={handlePhotoUpload}
              />
            )}
            {currentStep === 1 && (
              <ProfessionalDataForm 
                data={formData} 
                onChange={(updates) => setFormData({ ...formData, ...updates })} 
              />
            )}
            {currentStep === 2 && (
              <FinancialForm 
                data={formData} 
                onChange={(updates) => setFormData({ ...formData, ...updates })} 
              />
            )}
            {currentStep === 3 && (
              <TeacherAvailability 
                data={formData} 
                onChange={(updates) => setFormData({ ...formData, ...updates })} 
              />
            )}
            {currentStep === 4 && (
              <TeacherBlockDates 
                data={formData} 
                onChange={(updates) => setFormData({ ...formData, ...updates })} 
              />
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="h-20 border-t border-zinc-800 flex items-center justify-between px-8 bg-zinc-900/50">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-wider transition-all ${
              currentStep === 0 
                ? 'opacity-0 pointer-events-none' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>

          {currentStep === STEPS.length - 1 ? (
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-3 bg-brand-red hover:bg-red-600 text-white rounded-xl font-bold uppercase text-xs tracking-wider shadow-lg shadow-brand-red/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                'Salvando...'
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Professor
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-8 py-3 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold uppercase text-xs tracking-wider shadow-lg transition-all"
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
