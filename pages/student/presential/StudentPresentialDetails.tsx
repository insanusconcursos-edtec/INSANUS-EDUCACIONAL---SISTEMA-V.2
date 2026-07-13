import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { classService } from '../../../services/classService';
import { courseService } from '../../../services/courseService';
import { classScheduleService } from '../../../services/classScheduleService';
import { curriculumService } from '../../../services/curriculumService';
import { Class } from '../../../types/class';
import { OnlineCourse, CourseModule } from '../../../types/course';
import { ArrowLeft, Calendar, GraduationCap, BookOpen, ChevronDown, Radio, Video, Clock, Play, FileText } from 'lucide-react';
import { StudentClassSchedule } from '../../../components/student/presential/StudentClassSchedule';
import { StudentModuleCard } from '../../../components/student/courses/StudentModuleCard';
import { CoursePlayer } from '../../../components/student/courses/player/CoursePlayer';
import { StudentPedagogicalPlanning } from '../../../components/student/presential/StudentPedagogicalPlanning';
import { ConcursoStatusBanner } from '../../../components/student/presential/ConcursoStatusBanner';
import { liveEventService } from '../../../services/liveEventService';
import { LiveEvent } from '../../../types/liveEvent';
import { LinkedSimulatedView } from '../../../components/student/simulados/LinkedSimulatedView';
import { useStudyContext } from '../../../contexts/StudyContext';

export const StudentPresentialDetails: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setCurrentProduct } = useStudyContext();
  const moduleIdParam = searchParams.get('module');
  
  const [currentClass, setCurrentClass] = useState<Class | null>(null);
  const [activeTab, setActiveTab] = useState<'TEACHING' | 'SCHEDULE' | 'PLANNING' | 'LIVE' | 'SIMULADOS' | 'LINKED_COURSE'>('TEACHING');
  const [loading, setLoading] = useState(true);
  const [classLiveEvents, setClassLiveEvents] = useState<LiveEvent[]>([]);
  
  // Linked Course State
  const [linkedCourse, setLinkedCourse] = useState<OnlineCourse | null>(null);
  const [linkedCourseModules, setLinkedCourseModules] = useState<CourseModule[]>([]);
  const [loadingLinkedCourse, setLoadingLinkedCourse] = useState(false);
  const [selectedLinkedModule, setSelectedLinkedModule] = useState<CourseModule | null>(null);

  // Update current product for support
  useEffect(() => {
    if (currentClass) {
      setCurrentProduct({
        type: 'turma_presencial',
        id: currentClass.id,
        name: currentClass.name
      });
    }
    return () => {
      setCurrentProduct(null);
    };
  }, [currentClass, setCurrentProduct]);
  
  // Tab availability flags
  const [hasModules, setHasModules] = useState(false);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [hasPlanning, setHasPlanning] = useState(false);
  
  // Teaching Tab State
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [selectedModule, setSelectedModule] = useState<CourseModule | null>(null);
  const [loadingModules, setLoadingModules] = useState(false);

  const tabs = React.useMemo(() => [
    { id: 'TEACHING', label: 'ÁREA DE ENSINO', icon: GraduationCap, show: hasModules },
    { id: 'SCHEDULE', label: 'CRONOGRAMA', icon: Calendar, show: hasSchedule },
    { id: 'PLANNING', label: 'PLANEJAMENTO PEDAGÓGICO', icon: BookOpen, show: hasPlanning },
    { id: 'LIVE', label: '🔴 EVENTOS AO VIVO', icon: Radio, show: classLiveEvents.length > 0 },
    { id: 'SIMULADOS', label: 'SIMULADOS', icon: FileText, show: !!currentClass?.linkedSimulatedId },
    { id: 'LINKED_COURSE', label: (currentClass?.linkedCourseTabLabel || 'CURSO ONLINE').toUpperCase(), icon: Video, show: !!currentClass?.linkedCourseId },
  ].filter(tab => tab.show), [hasModules, hasSchedule, hasPlanning, classLiveEvents, currentClass]);

  useEffect(() => {
    const fetchClass = async () => {
      if (classId) {
        try {
          const data = await classService.getClassById(classId);
          if (data) {
            setCurrentClass(data);
            
            // Determine which ID to use for content (Modules, Planning, etc.)
            const contentId = data.masterClassId || classId;

            // Check content availability in parallel
            // Note: Schedule (eventsData) always stays with the specific classId
            const [modulesData, eventsData, subjectsData, liveEventsData] = await Promise.all([
              courseService.getModules(contentId),
              classScheduleService.getScheduleEventsByClass(classId),
              curriculumService.getSubjectsByClass(contentId),
              liveEventService.getLiveEventsByPresentialClass(contentId)
            ]);
            
            const hModules = modulesData.length > 0;
            const hSchedule = eventsData.length > 0;
            const hPlanning = subjectsData.length > 0;
            const hLive = liveEventsData.length > 0;
            
            // For Simulateds, we check the child first, then the master
            let hSimulated = !!data.linkedSimulatedId;
            if (!hSimulated && data.masterClassId) {
              const masterData = await classService.getClassById(data.masterClassId);
              if (masterData?.linkedSimulatedId) {
                hSimulated = true;
                // Update the current class state with the master's simulated ID if needed for the UI
                setCurrentClass(prev => prev ? ({ ...prev, linkedSimulatedId: masterData.linkedSimulatedId }) : null);
              }
            }
            
            setHasModules(hModules);
            setHasSchedule(hSchedule);
            setHasPlanning(hPlanning);
            setModules(modulesData);
            setClassLiveEvents(liveEventsData);

            // Fetch Linked Course if exists
            if (data.linkedCourseId) {
              setLoadingLinkedCourse(true);
              try {
                const [lCourse, lModules] = await Promise.all([
                  courseService.getCourse(data.linkedCourseId),
                  courseService.getModules(data.linkedCourseId)
                ]);
                setLinkedCourse(lCourse);
                setLinkedCourseModules(lModules);
              } catch (err) {
                console.error("Error fetching linked course:", err);
              } finally {
                setLoadingLinkedCourse(false);
              }
            }

            // Adjust active tab if current one is hidden
            const availableIds = [
              ...(hModules ? ['TEACHING'] : []),
              ...(hSchedule ? ['SCHEDULE'] : []),
              ...(hPlanning ? ['PLANNING'] : []),
              ...(hLive ? ['LIVE'] : []),
              ...(hSimulated ? ['SIMULADOS'] : []),
              ...(data.linkedCourseId ? ['LINKED_COURSE'] : [])
            ];

            if (availableIds.length > 0 && !availableIds.includes(activeTab)) {
              setActiveTab(availableIds[0] as any);
            }
          }
        } catch (error) {
          console.error("Error fetching class:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchClass();
  }, [classId]);

  useEffect(() => {
    const fetchModules = async () => {
      if (activeTab === 'TEACHING' && currentClass) {
        setLoadingModules(true);
        try {
          const contentId = currentClass.masterClassId || currentClass.id;
          const data = await courseService.getModules(contentId);
          setModules(data);
        } catch (error) {
          console.error("Error fetching modules:", error);
        } finally {
          setLoadingModules(false);
        }
      }
    };

    fetchModules();
  }, [activeTab, currentClass]);

  // Deep Linking: Switch to Teaching tab if module param is present, or Planning if tab param is present
  useEffect(() => {
    if (moduleIdParam) {
      setActiveTab('TEACHING');
    }
    const tabParam = searchParams.get('tab');
    if (tabParam?.toUpperCase() === 'PLANNING') {
      setActiveTab('PLANNING');
    }
  }, [moduleIdParam, searchParams]);

  // Deep Linking: Auto-select module when modules are loaded
  useEffect(() => {
    if (moduleIdParam && modules.length > 0 && activeTab === 'TEACHING' && !selectedModule) {
      const module = modules.find(m => m.id === moduleIdParam);
      if (module) {
        setSelectedModule(module);
      }
    }
  }, [moduleIdParam, modules, activeTab, selectedModule]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!currentClass) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white">
        <h2 className="text-2xl font-bold mb-4">Turma não encontrada</h2>
        <button 
          onClick={() => navigate('/app/presential')}
          className="px-4 py-2 bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Voltar para Turmas
        </button>
      </div>
    );
  }

  // Adapter to use CoursePlayer with Class data
  const fakeCourse: OnlineCourse = {
    id: currentClass.id,
    title: currentClass.name,
    coverUrl: currentClass.coverImage,
    bannerUrlDesktop: currentClass.bannerUrlDesktop,
    bannerUrlTablet: currentClass.bannerUrlTablet,
    bannerUrlMobile: currentClass.bannerUrlMobile,
    categoryId: currentClass.category,
    subcategoryId: currentClass.subcategory,
    organization: currentClass.organization,
    createdAt: currentClass.createdAt || new Date().toISOString(),
    updatedAt: currentClass.updatedAt || new Date().toISOString(),
    active: true
  };

  // Netflix-style horizontal scroll container classes
  const netflixContainerClasses = "flex overflow-x-auto pb-6 gap-6 snap-x snap-mandatory scroll-smooth";
  const netflixItemClasses = "flex-none w-[200px] sm:w-[240px] md:w-[280px] snap-start";

  return (
    <div className="min-h-screen bg-black text-gray-100 pb-20">
      {/* --- BANNER RESPONSIVO --- */}
      <div className="relative w-full bg-zinc-900">
        <button 
          onClick={() => navigate('/app/presential')}
          className="absolute top-4 left-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors backdrop-blur-sm"
        >
          <ArrowLeft size={24} />
        </button>
        
        <picture>
          <source 
            media="(min-width: 1024px)" 
            srcSet={currentClass.bannerUrlDesktop || currentClass.coverImage} 
          />
          <source 
            media="(min-width: 768px)" 
            srcSet={currentClass.bannerUrlTablet || currentClass.bannerUrlDesktop || currentClass.coverImage} 
          />
          <img 
            src={currentClass.bannerUrlMobile || currentClass.coverImage} 
            alt={`Banner da turma ${currentClass.name}`} 
            className="w-full h-48 md:h-[400px] object-cover border-b border-red-600/30 shadow-lg"
            referrerPolicy="no-referrer"
          />
        </picture>
        
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black to-transparent h-24 md:h-32 pointer-events-none"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-6">
        <ConcursoStatusBanner classData={currentClass} />
      </div>

      {/* --- NAVEGAÇÃO DE ABAS --- */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-md border-b border-zinc-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4">
          {/* Desktop Tabs Navigation */}
          <div className="hidden md:flex items-center space-x-8 overflow-x-auto no-scrollbar py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-3 text-base font-medium transition-colors whitespace-nowrap border-b-2 ${
                  activeTab === tab.id 
                    ? 'border-red-600 text-red-600' 
                    : 'border-transparent text-zinc-400 hover:text-white hover:border-zinc-700'
                }`}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Mobile Select Navigation */}
          <div className="md:hidden flex justify-center py-3">
            {tabs.length > 0 && (
              <div className="relative w-full max-w-[280px]">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-red-600 pointer-events-none">
                  {React.createElement(tabs.find(t => t.id === activeTab)?.icon || GraduationCap, { size: 18 })}
                </div>
                <select
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value as any)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-lg pl-10 pr-10 py-2.5 text-sm font-bold appearance-none focus:outline-none focus:ring-1 focus:ring-red-600/50"
                >
                  {tabs.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                  <ChevronDown size={16} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- ÁREA DE CONTEÚDO --- */}
      <div className="max-w-7xl mx-auto px-4 mt-6 md:mt-8">
        {activeTab === 'TEACHING' && (
          selectedModule ? (
            <CoursePlayer 
              course={fakeCourse} 
              module={selectedModule} 
              onBack={() => setSelectedModule(null)} 
            />
          ) : (
            loadingModules ? (
              <div className="flex gap-4 overflow-hidden">
                {[1,2,3].map(i => <div key={i} className="w-60 h-[300px] bg-gray-900 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-200 flex items-center">
                  <GraduationCap className="mr-2 text-red-500" />
                  Módulos de Ensino
                </h3>
                
                {modules.length === 0 ? (
                  <div className="p-8 text-center bg-gray-900/50 rounded-xl border border-gray-800 text-gray-500">
                    Nenhum módulo disponível para esta turma.
                  </div>
                ) : (
                  <div className={netflixContainerClasses}>
                    {modules.map(module => (
                      <div key={module.id} className={netflixItemClasses}>
                        <StudentModuleCard 
                          module={module} 
                          onClick={setSelectedModule} 
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )
        )}

        {activeTab === 'LINKED_COURSE' && currentClass?.linkedCourseId && (
          selectedLinkedModule ? (
            <CoursePlayer 
              course={linkedCourse!} 
              module={selectedLinkedModule} 
              onBack={() => setSelectedLinkedModule(null)} 
            />
          ) : (
            loadingLinkedCourse ? (
              <div className="flex gap-4 overflow-hidden">
                {[1,2,3].map(i => <div key={i} className="w-60 h-[300px] bg-gray-900 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-200 flex items-center">
                  <Video className="mr-2 text-red-500" />
                  {currentClass?.linkedCourseTabLabel || 'Módulos do Curso'}
                </h3>
                
                {linkedCourseModules.length === 0 ? (
                  <div className="p-8 text-center bg-gray-900/50 rounded-xl border border-gray-800 text-gray-500">
                    Nenhum módulo disponível para este curso.
                  </div>
                ) : (
                  <div className={netflixContainerClasses}>
                    {linkedCourseModules.map(module => (
                      <div key={module.id} className={netflixItemClasses}>
                        <StudentModuleCard 
                          module={module} 
                          onClick={setSelectedLinkedModule} 
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )
        )}

        {activeTab === 'SCHEDULE' && (
          <StudentClassSchedule 
            classId={currentClass.id} 
            masterClassId={currentClass.masterClassId} 
          />
        )}

        {activeTab === 'PLANNING' && (
          <StudentPedagogicalPlanning 
            classId={currentClass.id}
            masterClassId={currentClass.masterClassId}
            totalMeetings={currentClass.totalMeetings}
          />
        )}

        {activeTab === 'LIVE' && classLiveEvents.length > 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classLiveEvents.map((event) => (
                <div 
                  key={event.id} 
                  className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden flex flex-col group hover:border-zinc-700 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-zinc-800">
                    {event.thumbnailUrl ? (
                      <img 
                        src={event.thumbnailUrl} 
                        alt={event.title} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        <Video size={48} />
                      </div>
                    )}
                    
                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg ${
                        event.status === 'live' ? 'bg-red-600 text-white animate-pulse' :
                        event.status === 'scheduled' ? 'bg-blue-600 text-white' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {event.status === 'live' ? 'AO VIVO AGORA' : event.status === 'scheduled' ? 'AGENDADO' : 'ENCERRADO'}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-lg font-bold text-white mb-1 line-clamp-2">{event.title}</h3>
                    {event.subtitle && (
                      <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{event.subtitle}</p>
                    )}
                    
                    <div className="mt-auto space-y-2 mb-6">
                      <div className="flex items-center gap-2 text-zinc-300 text-sm">
                        <Calendar size={16} className="text-zinc-500" />
                        <span>{event.eventDate.split('-').reverse().join('/')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-300 text-sm">
                        <Clock size={16} className="text-zinc-500" />
                        <span>{event.startTime}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate(`/app/eventos-ao-vivo/sala/${event.id}`)}
                      className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                        event.status === 'live' 
                          ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20' 
                          : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                      }`}
                    >
                      {event.status === 'live' ? (
                        <>
                          <Play size={18} fill="currentColor" />
                          ACESSAR SALA DE TRANSMISSÃO
                        </>
                      ) : (
                        'VER DETALHES DO EVENTO'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'SIMULADOS' && currentClass?.linkedSimulatedId && (
          <LinkedSimulatedView simulatedId={currentClass.linkedSimulatedId} />
        )}
      </div>


    </div>
  );
};
