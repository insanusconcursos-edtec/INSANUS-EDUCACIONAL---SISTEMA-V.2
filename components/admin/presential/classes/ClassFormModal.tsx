import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Save, Loader2 } from 'lucide-react';
import { Class } from '../../../../types/class';
import { classService } from '../../../../services/classService';
import { ClassIdentityForm } from './forms/ClassIdentityForm';
import { ClassStructureForm } from './forms/ClassStructureForm';
import { ClassScheduleForm } from './forms/ClassScheduleForm';
import { ClassroomSelectionForm } from './forms/ClassroomSelectionForm';

interface ClassFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  classToEdit?: Class | null;
}

const INITIAL_DATA: Partial<Class> = {
  name: '',
  type: 'PRE_EDITAL',
  modality: 'REGULAR',
  hasRecordings: false,
  totalMeetings: 0,
  meetingDuration: 0,
  classesPerMeeting: 0,
  hasBreak: false,
  breakDuration: 0,
  shift: 'MORNING',
  startTime: '',
  daysOfWeek: [],
  allowWeekend: false,
  weekendConfigs: [],
  startDate: '',
  holidaysOff: true,
  status: 'SALES_OPEN',
  category: '',
  subcategory: '',
  organization: '',
  linkedSimulatedId: null
};

const STEPS = [
  { id: 1, title: 'Identidade' },
  { id: 2, title: 'Estrutura' },
  { id: 3, title: 'Cronograma' },
  { id: 4, title: 'Alocação' }
];

export const ClassFormModal: React.FC<ClassFormModalProps> = ({ isOpen, onClose, onSuccess, classToEdit }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<Class>>(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [breakCount, setBreakCount] = useState(1); // Auxiliary state for structure form
  
  // States for banner files
  const [bannerDesktopFile, setBannerDesktopFile] = useState<File | undefined>(undefined);
  const [bannerTabletFile, setBannerTabletFile] = useState<File | undefined>(undefined);
  const [bannerMobileFile, setBannerMobileFile] = useState<File | undefined>(undefined);

  React.useEffect(() => {
    if (isOpen) {
      if (classToEdit) {
        setFormData(classToEdit);
        // Calculate break count if needed, though it's not stored directly in Class interface as a count, 
        // but derived from logic. For now, we default to 1 if hasBreak is true.
        if (classToEdit.hasBreak) {
           setBreakCount(1); // Ideally this should be calculated or stored if variable
        }
      } else {
        setFormData(INITIAL_DATA);
        setBreakCount(1);
      }
      setCurrentStep(1);
      setBannerDesktopFile(undefined);
      setBannerTabletFile(undefined);
      setBannerMobileFile(undefined);
    }
  }, [isOpen, classToEdit]);

  const updateFormData = (updates: Partial<Class>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: // Identity
        if (!formData.name?.trim()) {
          alert('Por favor, informe o nome da turma.');
          return false;
        }
        return true;
      case 2: // Structure
        if (!formData.totalMeetings || formData.totalMeetings <= 0) {
          alert('Informe o total de encontros.');
          return false;
        }
        if (!formData.meetingDuration || formData.meetingDuration <= 0) {
          alert('Informe a duração do encontro.');
          return false;
        }
        if (!formData.classesPerMeeting || formData.classesPerMeeting <= 0) {
          alert('Informe a quantidade de aulas por encontro.');
          return false;
        }
        return true;
      case 3: // Schedule
        if (!formData.startTime) {
          alert('Informe o horário de início.');
          return false;
        }
        if (!formData.daysOfWeek || formData.daysOfWeek.length === 0) {
          alert('Selecione pelo menos um dia da semana.');
          return false;
        }
        if (!formData.startDate) {
          alert('Informe a data de início.');
          return false;
        }
        if (formData.type === 'POS_EDITAL' && !formData.hardDeadline) {
          alert('Para turmas Pós-Edital, a Data Limite (Hard Deadline) é obrigatória.');
          return false;
        }
        return true;
      case 4: // Room
        if (!formData.classroomId) {
          alert('Selecione uma sala de aula.');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    try {
      setLoading(true);
      if (classToEdit && classToEdit.id) {
        await classService.updateClass(classToEdit.id, formData, bannerDesktopFile, bannerMobileFile, bannerTabletFile);
      } else {
        await classService.createClass(formData as Omit<Class, 'id'>, bannerDesktopFile, bannerMobileFile, bannerTabletFile);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving class:', error);
      alert('Erro ao salvar turma. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <div>
            <h2 className="text-lg font-bold text-white uppercase tracking-tight">
              {classToEdit ? 'Editar Turma' : 'Nova Turma Presencial'}
            </h2>
            <p className="text-xs text-zinc-500">Passo {currentStep} de {STEPS.length}: {STEPS[currentStep - 1].title}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex w-full h-1 bg-zinc-800">
          {STEPS.map((step) => (
            <div
              key={step.id}
              className={`h-full transition-all duration-500 ${
                step.id <= currentStep ? 'bg-brand-red' : 'bg-transparent'
              }`}
              style={{ width: `${100 / STEPS.length}%` }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700">
          {currentStep === 1 && (
            <ClassIdentityForm 
              data={formData} 
              onChange={updateFormData} 
              onBannerDesktopChange={setBannerDesktopFile}
              onBannerTabletChange={setBannerTabletFile}
              onBannerMobileChange={setBannerMobileFile}
            />
          )}
          {currentStep === 2 && (
            <ClassStructureForm 
              data={formData} 
              onChange={updateFormData} 
              breakCount={breakCount}
              setBreakCount={setBreakCount}
            />
          )}
          {currentStep === 3 && (
            <ClassScheduleForm data={formData} onChange={updateFormData} />
          )}
          {currentStep === 4 && (
            <ClassroomSelectionForm 
              data={formData} 
              onChange={updateFormData}
              hasRecordings={formData.hasRecordings || false}
            />
          )}
        </div>

        {/* Footer / Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
          <button
            onClick={handleBack}
            disabled={currentStep === 1 || loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${
              currentStep === 1 
                ? 'text-zinc-600 cursor-not-allowed' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>

          {currentStep < STEPS.length ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2 bg-zinc-100 hover:bg-white text-zinc-900 rounded-lg font-bold uppercase text-xs tracking-wider transition-colors"
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-brand-red hover:bg-red-600 text-white rounded-lg font-bold uppercase text-xs tracking-wider shadow-lg shadow-brand-red/20 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Turma
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
