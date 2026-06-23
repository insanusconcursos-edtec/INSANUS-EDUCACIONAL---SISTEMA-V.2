
import { db, storage } from './firebase';
import { sanitizeData, deepCloneSafe } from './firestoreUtils';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  orderBy, 
  where,
  writeBatch,
  increment,
  setDoc,
  serverTimestamp,
  getCountFromServer,
  deleteField,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { OnlineCourse, CourseFormData, CourseModule, CourseSubModule, CourseLesson, CourseContent, CourseStructureModule, CourseStructureFolder } from '../types/course';
import { CourseEditalStructure } from '../types/courseEdital';

const COLLECTION_NAME = 'online_courses';
const MODULES_COLLECTION = 'course_modules';
const SUBMODULES_COLLECTION = 'course_submodules';
const GROUPS_COLLECTION = 'course_groups';
const LESSONS_COLLECTION = 'course_lessons';
const CONTENTS_COLLECTION = 'course_contents';
const EDITAL_COLLECTION = 'course_edital'; 

export const courseService = {
  // --- AUXILIARES ---
  
  safeDeleteStorageFile: async (url?: string) => {
    if (!url || !url.includes('firebasestorage.googleapis.com')) return;
    try {
      const fileRef = ref(storage, url);
      await deleteObject(fileRef);
    } catch (error: any) {
      if (error.code === 'storage/object-not-found') return;
      console.warn("Erro ao deletar arquivo do storage:", error);
    }
  },

  // --- GRUPOS ---

  createGroup: async (data: Omit<CourseGroup, 'id'>) => {
    try {
      const q = query(
        collection(db, GROUPS_COLLECTION), 
        where('moduleId', '==', data.moduleId),
        orderBy('order', 'desc')
      );
      const snapshot = await getDocs(q);
      const lastOrder = snapshot.docs.length > 0 ? snapshot.docs[0].data().order : 0;

      const docRef = await addDoc(collection(db, GROUPS_COLLECTION), {
        ...data,
        order: lastOrder + 1
      });
      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar grupo:", error);
      throw error;
    }
  },

  getGroups: async (moduleId: string): Promise<CourseGroup[]> => {
    try {
      const q = query(
        collection(db, GROUPS_COLLECTION),
        where('moduleId', '==', moduleId),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseGroup));
    } catch (error) {
      console.error("Erro ao buscar grupos:", error);
      throw error;
    }
  },

  updateGroup: async (id: string, data: Partial<CourseGroup>) => {
    await updateDoc(doc(db, GROUPS_COLLECTION, id), data);
  },

  deleteGroup: async (id: string) => {
    await deleteDoc(doc(db, GROUPS_COLLECTION, id));
  },

  reorderGroups: async (groups: CourseGroup[]) => {
    try {
      const batch = writeBatch(db);
      groups.forEach((group, index) => {
        const docRef = doc(db, GROUPS_COLLECTION, group.id);
        batch.update(docRef, { order: index + 1 });
      });
      await batch.commit();
    } catch (error) {
      console.error("Erro ao reordenar grupos:", error);
      throw error;
    }
  },

  // Helper para upload de Banner
  uploadBanner: async (file: File): Promise<string> => {
    try {
      const storageRef = ref(storage, `course_banners/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error("Erro upload banner:", error);
      throw error;
    }
  },

  // Criar novo curso
  createCourse: async (data: CourseFormData, bannerDesktopFile?: File, bannerMobileFile?: File): Promise<string> => {
    try {
      const finalData: Partial<OnlineCourse> = { ...data };

      if (bannerDesktopFile) {
        finalData.bannerUrlDesktop = await courseService.uploadBanner(bannerDesktopFile);
      }
      if (bannerMobileFile) {
        finalData.bannerUrlMobile = await courseService.uploadBanner(bannerMobileFile);
      }

      const docRef = await addDoc(collection(db, COLLECTION_NAME), sanitizeData({
        ...finalData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        active: true
      }));
      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar curso:", error);
      throw error;
    }
  },

  // Listar cursos
  getCourses: async (): Promise<OnlineCourse[]> => {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as OnlineCourse));
    } catch (error) {
      console.error("Erro ao buscar cursos:", error);
      throw error;
    }
  },

  // Atualizar curso
  updateCourse: async (id: string, data: Partial<CourseFormData>, bannerDesktopFile?: File, bannerMobileFile?: File) => {
    try {
      const finalData: Partial<OnlineCourse> = { ...data };

      if (bannerDesktopFile) {
        finalData.bannerUrlDesktop = await courseService.uploadBanner(bannerDesktopFile);
      }
      if (bannerMobileFile) {
        finalData.bannerUrlMobile = await courseService.uploadBanner(bannerMobileFile);
      }

      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, sanitizeData({
        ...finalData,
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      console.error("Erro ao atualizar curso:", error);
      throw error;
    }
  },

  // Excluir curso
  deleteCourse: async (id: string) => {
    try {
      // 1. Deletar módulos do curso
      const modulesQuery = query(collection(db, MODULES_COLLECTION), where('courseId', '==', id));
      const modulesSnap = await getDocs(modulesQuery);
      const deleteModulesPromises = modulesSnap.docs.map(d => courseService.deleteModule(d.id));
      await Promise.all(deleteModulesPromises);

      // 2. Deletar ativos do curso (capas, banners)
      const courseSnap = await getDoc(doc(db, COLLECTION_NAME, id));
      if (courseSnap.exists()) {
        const course = courseSnap.data() as OnlineCourse;
        if (course.coverUrl) await courseService.safeDeleteStorageFile(course.coverUrl);
        if (course.bannerUrlDesktop) await courseService.safeDeleteStorageFile(course.bannerUrlDesktop);
        if (course.bannerUrlTablet) await courseService.safeDeleteStorageFile(course.bannerUrlTablet);
        if (course.bannerUrlMobile) await courseService.safeDeleteStorageFile(course.bannerUrlMobile);
        if (course.welcomeVideoUrl) await courseService.safeDeleteStorageFile(course.welcomeVideoUrl);
      }

      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
      console.error("Erro ao excluir curso:", error);
      throw error;
    }
  },

  // Duplicar curso (Deep Copy)
  duplicateCourse: async (originalCourse: OnlineCourse) => {
    try {
      console.log(`[DUPLICATE] Iniciando duplicação do curso: ${originalCourse.title}`);
      const operations: { ref: DocumentReference, data: object }[] = [];

      // 1. Criar novo curso (Metadata)
      const newCourseRef = doc(collection(db, COLLECTION_NAME));
      const newCourseData: any = {
        ...originalCourse,
        title: `${originalCourse.title} - Cópia`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        active: true,
        // Sanitização de acessos (Zerar base de alunos)
        allowedUsers: [],
        enrolledStudents: [],
        studentsCount: 0
      };
      delete newCourseData.id;
      operations.push({ ref: newCourseRef, data: newCourseData });

      // Mapeamentos para manter integridade referencial
      const moduleMapping: Record<string, string> = {};
      const subModuleMapping: Record<string, string> = {};
      const lessonMapping: Record<string, string> = {};

      // 2. Módulos
      const modules = await courseService.getModules(originalCourse.id);
      console.log(`[DUPLICATE] ${modules.length} módulos encontrados.`);

      // Processamento em paralelo de módulos
      await Promise.all(modules.map(async (mod) => {
        const newModRef = doc(collection(db, MODULES_COLLECTION));
        moduleMapping[mod.id] = newModRef.id;
        
        const newModData: any = {
          ...mod,
          courseId: newCourseRef.id
        };
        delete newModData.id;
        operations.push({ ref: newModRef, data: newModData });

        // 3. Submódulos (Pastas) e Aulas em paralelo
        const [subModules, lessons] = await Promise.all([
          courseService.getSubModules(mod.id),
          courseService.getLessons(mod.id)
        ]);

        // Processar Submódulos
        subModules.forEach(sub => {
          const newSubRef = doc(collection(db, SUBMODULES_COLLECTION));
          subModuleMapping[sub.id] = newSubRef.id;
          
          const newSubData: any = {
            ...sub,
            moduleId: newModRef.id
          };
          delete newSubData.id;
          operations.push({ ref: newSubRef, data: newSubData });
        });

        // Processar Aulas e seus conteúdos
        await Promise.all(lessons.map(async (lesson) => {
          const newLessonRef = doc(collection(db, LESSONS_COLLECTION));
          lessonMapping[lesson.id] = newLessonRef.id;
          
          const newLessonData: any = {
            ...lesson,
            moduleId: newModRef.id,
            // O subModuleId será atualizado depois se necessário, ou aqui se já tivermos o mapeamento
            // Como estamos processando subModules de forma síncrona acima, o mapeamento já existe
            subModuleId: lesson.subModuleId ? subModuleMapping[lesson.subModuleId] : null
          };
          delete newLessonData.id;
          operations.push({ ref: newLessonRef, data: newLessonData });

          // 5. Conteúdos da Aula
          const contents = await courseService.getContents(lesson.id);
          contents.forEach(content => {
            const newContentRef = doc(collection(db, CONTENTS_COLLECTION));
            const newContentData: any = {
              ...content,
              lessonId: newLessonRef.id
            };
            delete newContentData.id;
            operations.push({ ref: newContentRef, data: newContentData });
          });
        }));
      }));

        // 6. Edital Verticalizado
        const edital = await courseService.getCourseEdital(originalCourse.id);
        if (edital) {
            console.log(`[DUPLICATE] Edital encontrado, processando...`);
            const newEditalRef = doc(db, EDITAL_COLLECTION, newCourseRef.id);
            
            // Clonagem profunda do edital
            const newEditalData: CourseEditalStructure = deepCloneSafe(edital);
            newEditalData.courseId = newCourseRef.id;
            newEditalData.updatedAt = serverTimestamp();

            newEditalData.disciplines.forEach(discipline => {
                // 1. Novos IDs para Disciplinas
                discipline.id = crypto.randomUUID();

                // 2. Mapeamento de Grupos
                const groupMapping: Record<string, string> = {};
                if (discipline.topicGroups) {
                    discipline.topicGroups.forEach(group => {
                        const oldGroupId = group.id;
                        group.id = crypto.randomUUID();
                        groupMapping[oldGroupId] = group.id;
                    });
                }

                // 3. Função recursiva para tópicos e sub-referências
                const updateTopicsRecursive = (topics: any[]) => {
                    topics.forEach(topic => {
                        // Novo ID de Tópico (FUNDAMENTAL para isolar progresso)
                        topic.id = crypto.randomUUID();
                        
                        // Remapear Grupo
                        if (topic.groupId && groupMapping[topic.groupId]) {
                            topic.groupId = groupMapping[topic.groupId];
                        }

                        // Remapear Aulas Vinculadas (Usando lessonMapping já criado)
                        if (topic.linkedLessons) {
                            topic.linkedLessons = topic.linkedLessons.map((ll: any) => ({
                                ...ll,
                                id: lessonMapping[ll.id] || ll.id,
                                moduleId: moduleMapping[ll.moduleId] || ll.moduleId
                            }));
                        }

                        // Recursão para sub-tópicos
                        if (topic.subtopics && topic.subtopics.length > 0) {
                            updateTopicsRecursive(topic.subtopics);
                        }
                    });
                };

                updateTopicsRecursive(discipline.topics);
            });

            operations.push({ ref: newEditalRef, data: newEditalData });
        }

      console.log(`[DUPLICATE] Total de operações preparadas: ${operations.length}. Iniciando gravação em lotes.`);

      // 7. Execução em Lotes (Chunked Batches)
      const MAX_BATCH_SIZE = 400;
      let batch = writeBatch(db);
      let operationCounter = 0;
      const commitPromises: Promise<void>[] = [];

      const addOperationToBatch = () => {
        operationCounter++;
        if (operationCounter === MAX_BATCH_SIZE) {
          commitPromises.push(batch.commit());
          batch = writeBatch(db);
          operationCounter = 0;
        }
      };

      for (const op of operations) {
        batch.set(op.ref, sanitizeData(op.data));
        addOperationToBatch();
      }

      if (operationCounter > 0) {
        commitPromises.push(batch.commit());
      }

      await Promise.all(commitPromises);
      console.log(`[DUPLICATE] Duplicação concluída com sucesso! Novo ID: ${newCourseRef.id}`);

      return newCourseRef.id;
    } catch (error) {
      console.error("Erro ao duplicar curso:", error);
      throw error;
    }
  },

  // Upload de Capa
  uploadCover: async (file: File): Promise<string> => {
    try {
      const storageRef = ref(storage, `course_covers/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error("Erro ao fazer upload da capa:", error);
      throw error;
    }
  },

  // --- MÓDULOS ---

  createModule: async (moduleData: Omit<CourseModule, 'id'>) => {
    try {
      const q = query(
        collection(db, MODULES_COLLECTION), 
        where('courseId', '==', moduleData.courseId),
        orderBy('order', 'desc')
      );
      const snapshot = await getDocs(q);
      const lastOrder = snapshot.docs.length > 0 ? snapshot.docs[0].data().order : 0;

      const docRef = await addDoc(collection(db, MODULES_COLLECTION), {
        ...moduleData,
        order: lastOrder + 1
      });
      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar módulo:", error);
      throw error;
    }
  },

  getModules: async (courseId: string): Promise<CourseModule[]> => {
    try {
      const q = query(
        collection(db, MODULES_COLLECTION),
        where('courseId', '==', courseId),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CourseModule));
    } catch (error) {
      console.error("Erro ao buscar módulos:", error);
      throw error;
    }
  },

  updateModule: async (moduleId: string, data: Partial<CourseModule>) => {
    try {
      const docRef = doc(db, MODULES_COLLECTION, moduleId);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error("Erro ao atualizar módulo:", error);
      throw error;
    }
  },

  deleteModule: async (moduleId: string) => {
    try {
      // 1. Deletar pastas (submódulos) deste módulo
      const subModulesQuery = query(collection(db, SUBMODULES_COLLECTION), where('moduleId', '==', moduleId));
      const subModulesSnap = await getDocs(subModulesQuery);
      const deleteSubModulesPromises = subModulesSnap.docs.map(d => courseService.deleteSubModule(d.id));
      await Promise.all(deleteSubModulesPromises);

      // 2. Deletar aulas soltas (sem pasta) deste módulo
      const looseLessonsQuery = query(
        collection(db, LESSONS_COLLECTION), 
        where('moduleId', '==', moduleId),
        where('subModuleId', '==', null)
      );
      const looseLessonsSnap = await getDocs(looseLessonsQuery);
      const deleteLooseLessonsPromises = looseLessonsSnap.docs.map(d => courseService.deleteLesson(d.id));
      await Promise.all(deleteLooseLessonsPromises);

      // 3. Deletar capa do módulo
      const modSnap = await getDoc(doc(db, MODULES_COLLECTION, moduleId));
      if (modSnap.exists()) {
        const mod = modSnap.data() as CourseModule;
        if (mod.coverUrl) await courseService.safeDeleteStorageFile(mod.coverUrl);
      }

      await deleteDoc(doc(db, MODULES_COLLECTION, moduleId));
    } catch (error) {
      console.error("Erro ao excluir módulo:", error);
      throw error;
    }
  },

  reorderModules: async (modules: CourseModule[]) => {
    try {
      const batch = writeBatch(db);
      modules.forEach((mod, index) => {
        const docRef = doc(db, MODULES_COLLECTION, mod.id);
        batch.update(docRef, { order: index + 1 });
      });
      await batch.commit();
    } catch (error) {
      console.error("Erro ao reordenar módulos:", error);
      throw error;
    }
  },

  // --- PASTAS (SUBMÓDULOS) ---

  createSubModule: async (data: Omit<CourseSubModule, 'id'>) => {
    try {
      const q = query(
        collection(db, SUBMODULES_COLLECTION), 
        where('moduleId', '==', data.moduleId),
        orderBy('order', 'desc')
      );
      const snapshot = await getDocs(q);
      const lastOrder = snapshot.docs.length > 0 ? snapshot.docs[0].data().order : 0;

      const docRef = await addDoc(collection(db, SUBMODULES_COLLECTION), {
        ...data,
        order: lastOrder + 1
      });
      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar pasta:", error);
      throw error;
    }
  },

  getSubModules: async (moduleId: string): Promise<CourseSubModule[]> => {
    try {
      const q = query(
        collection(db, SUBMODULES_COLLECTION),
        where('moduleId', '==', moduleId),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseSubModule));
    } catch (error) {
      console.error("Erro ao buscar pastas:", error);
      throw error;
    }
  },

  updateSubModule: async (id: string, data: Partial<CourseSubModule>) => {
    await updateDoc(doc(db, SUBMODULES_COLLECTION, id), data);
  },

  deleteSubModule: async (id: string) => {
    try {
      // 1. Deletar aulas dentro desta pasta
      const lessonsQuery = query(collection(db, LESSONS_COLLECTION), where('subModuleId', '==', id));
      const lessonsSnap = await getDocs(lessonsQuery);
      const deleteLessonsPromises = lessonsSnap.docs.map(d => courseService.deleteLesson(d.id));
      await Promise.all(deleteLessonsPromises);

      // 2. Deletar subpastas recursivamente
      const subFoldersQuery = query(collection(db, SUBMODULES_COLLECTION), where('parentId', '==', id));
      const subFoldersSnap = await getDocs(subFoldersQuery);
      const deleteSubFoldersPromises = subFoldersSnap.docs.map(d => courseService.deleteSubModule(d.id));
      await Promise.all(deleteSubFoldersPromises);

      // 3. Deletar o documento da pasta
      await deleteDoc(doc(db, SUBMODULES_COLLECTION, id));
    } catch (error) {
      console.error("Erro ao excluir pasta:", error);
      throw error;
    }
  },

  reorderSubModules: async (subModules: CourseSubModule[]) => {
    try {
      const batch = writeBatch(db);
      subModules.forEach((sub, index) => {
        const docRef = doc(db, SUBMODULES_COLLECTION, sub.id);
        batch.update(docRef, { order: index + 1 });
      });
      await batch.commit();
    } catch (error) {
      console.error("Erro ao reordenar pastas:", error);
      throw error;
    }
  },

  // --- AULAS ---

  createLesson: async (data: Omit<CourseLesson, 'id'>) => {
    try {
      let q;
      if (data.subModuleId) {
        q = query(
          collection(db, LESSONS_COLLECTION),
          where('moduleId', '==', data.moduleId),
          where('subModuleId', '==', data.subModuleId),
          orderBy('order', 'desc')
        );
      } else {
        q = query(
          collection(db, LESSONS_COLLECTION),
          where('moduleId', '==', data.moduleId),
          where('subModuleId', '==', null),
          orderBy('order', 'desc')
        );
      }
      
      const snapshot = await getDocs(q);
      const lastOrder = snapshot.docs.length > 0 ? snapshot.docs[0].data().order : 0;

      const docRef = await addDoc(collection(db, LESSONS_COLLECTION), {
        ...data,
        order: lastOrder + 1
      });
      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar aula:", error);
      throw error;
    }
  },

  getLessons: async (moduleId: string): Promise<CourseLesson[]> => {
    try {
      const q = query(
        collection(db, LESSONS_COLLECTION),
        where('moduleId', '==', moduleId),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseLesson));
    } catch (error) {
      console.error("Erro ao buscar aulas:", error);
      throw error;
    }
  },

  updateLesson: async (id: string, data: Partial<CourseLesson>) => {
    await updateDoc(doc(db, LESSONS_COLLECTION, id), data);
  },

  deleteLesson: async (id: string) => {
    try {
      // Deletar conteúdos vinculados (PDFs, Vídeos, etc)
      const q = query(collection(db, CONTENTS_COLLECTION), where('lessonId', '==', id));
      const snapshot = await getDocs(q);
      
      const deletePromises = snapshot.docs.map(doc => courseService.deleteContent(doc.id));
      await Promise.all(deletePromises);

      // Deletar capa se houver
      const lessonSnap = await getDoc(doc(db, LESSONS_COLLECTION, id));
      if (lessonSnap.exists()) {
        const lesson = lessonSnap.data() as CourseLesson;
        if (lesson.coverUrl) await courseService.safeDeleteStorageFile(lesson.coverUrl);
      }

      await deleteDoc(doc(db, LESSONS_COLLECTION, id));
    } catch (error) {
      console.error("Erro ao excluir aula:", error);
      throw error;
    }
  },
  
  moveLesson: async (lessonId: string, targetSubModuleId: string | null) => {
     await updateDoc(doc(db, LESSONS_COLLECTION, lessonId), {
         subModuleId: targetSubModuleId
     });
  },

  moveSubModule: async (subModuleId: string, targetParentId: string | null) => {
    await updateDoc(doc(db, SUBMODULES_COLLECTION, subModuleId), {
        parentId: targetParentId
    });
  },

  reorderLessons: async (lessons: CourseLesson[]) => {
    try {
      const batch = writeBatch(db);
      lessons.forEach((lesson, index) => {
        const docRef = doc(db, LESSONS_COLLECTION, lesson.id);
        batch.update(docRef, { order: index + 1 });
      });
      await batch.commit();
    } catch (error) {
      console.error("Erro ao reordenar aulas:", error);
      throw error;
    }
  },

  reorderMixedContent: async (items: { type: 'folder' | 'lesson', id: string }[]) => {
    try {
      const batch = writeBatch(db);
      items.forEach((item, index) => {
        const collectionName = item.type === 'folder' ? SUBMODULES_COLLECTION : LESSONS_COLLECTION;
        const docRef = doc(db, collectionName, item.id);
        batch.update(docRef, { order: index + 1 });
      });
      await batch.commit();
    } catch (error) {
      console.error("Erro ao reordenar conteúdo misto:", error);
      throw error;
    }
  },

  // --- CONTEÚDOS ---

  createContent: async (data: Omit<CourseContent, 'id'>) => {
    try {
      const q = query(
        collection(db, CONTENTS_COLLECTION), 
        where('lessonId', '==', data.lessonId),
        orderBy('order', 'desc')
      );
      const snapshot = await getDocs(q);
      const lastOrder = snapshot.docs.length > 0 ? snapshot.docs[0].data().order : 0;

      const docRef = await addDoc(collection(db, CONTENTS_COLLECTION), {
        ...data,
        order: lastOrder + 1
      });

      const lessonRef = doc(db, LESSONS_COLLECTION, data.lessonId);
      if (data.type === 'video') await updateDoc(lessonRef, { videoCount: increment(1) });
      else if (data.type === 'pdf') await updateDoc(lessonRef, { pdfCount: increment(1) });

      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar conteúdo:", error);
      throw error;
    }
  },

  getContents: async (lessonId: string): Promise<CourseContent[]> => {
    try {
      const q = query(
        collection(db, CONTENTS_COLLECTION),
        where('lessonId', '==', lessonId),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseContent));
    } catch (error) {
      console.error("Erro ao buscar conteúdos:", error);
      throw error;
    }
  },

  updateContent: async (id: string, data: Partial<CourseContent>) => {
    await updateDoc(doc(db, CONTENTS_COLLECTION, id), data);
  },

  deleteContent: async (id: string) => {
    try {
      const contentRef = doc(db, CONTENTS_COLLECTION, id);
      const contentSnap = await getDoc(contentRef);

      if (contentSnap.exists()) {
        const content = contentSnap.data() as CourseContent;
        const lessonRef = doc(db, LESSONS_COLLECTION, content.lessonId);

        // Atualizar contadores
        if (content.type === 'video') await updateDoc(lessonRef, { videoCount: increment(-1) });
        else if (content.type === 'pdf') await updateDoc(lessonRef, { pdfCount: increment(-1) });

        // DELEÇÃO DE ARQUIVO FÍSICO (Storage)
        // Regra Geral: Se tem uma URL do Firebase Storage, deleta para evitar conteúdo "morto".
        // Isso cobre PDFs, Vídeos hospedados no Firebase, Imagens de conteúdo, etc.
        if (content.fileUrl) {
            await courseService.safeDeleteStorageFile(content.fileUrl);
        }
        
        // Também verifica videoUrl caso o vídeo tenha sido enviado para o Storage
        if (content.videoUrl && content.videoPlatform !== 'panda' && content.videoPlatform !== 'youtube') {
            await courseService.safeDeleteStorageFile(content.videoUrl);
        }

        await deleteDoc(contentRef);
      }
    } catch (error) {
      console.error("Erro ao excluir conteúdo:", error);
      throw error;
    }
  },

  reorderContents: async (contents: CourseContent[]) => {
    try {
      const batch = writeBatch(db);
      contents.forEach((item, index) => {
        const docRef = doc(db, CONTENTS_COLLECTION, item.id);
        batch.update(docRef, { order: index + 1 });
      });
      await batch.commit();
    } catch (error) {
      console.error("Erro ao reordenar conteúdos:", error);
      throw error;
    }
  },

  uploadPDF: async (file: File): Promise<string> => {
    try {
      const storageRef = ref(storage, `course_pdfs/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error("Erro ao fazer upload do PDF:", error);
      throw error;
    }
  },

  // --- PROGRESSO ---
  
  toggleLessonCompletion: async (userId: string, courseId: string, lessonId: string, isCompleted: boolean) => {
    try {
        const docRef = doc(db, 'users', userId, 'course_progress', courseId);
        const docSnap = await getDoc(docRef);
        
        let lessonProgress: Record<string, any> = {};
        let completedLessons: string[] = [];

        if (docSnap.exists()) {
            const data = docSnap.data();
            lessonProgress = data.lessonProgress || {};
            completedLessons = data.completedLessons || [];
            
            // Migração/Compatibilidade
            if (!data.lessonProgress && data.completedLessons) {
                data.completedLessons.forEach((id: string) => {
                    lessonProgress[id] = { completedAt: new Date().toISOString() };
                });
            }
        }

        if (isCompleted) {
            // Marcar como concluído
            lessonProgress[lessonId] = { completedAt: new Date().toISOString() };
            if (!completedLessons.includes(lessonId)) {
                completedLessons.push(lessonId);
            }
        } else {
            // Desmarcar: Usar deleteField() para garantir remoção no merge
            lessonProgress[lessonId] = deleteField();
            completedLessons = completedLessons.filter(id => id !== lessonId);
        }

        await setDoc(docRef, {
            completedLessons,
            lessonProgress,
            lastUpdated: serverTimestamp()
        }, { merge: true });
        return true;
    } catch (error) {
        console.error("Erro ao salvar progresso:", error);
        throw error;
    }
  },

  getCompletedLessons: async (userId: string, courseId: string): Promise<string[]> => {
    try {
        const docRef = doc(db, 'users', userId, 'course_progress', courseId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) return docSnap.data().completedLessons || [];
        return [];
    } catch {
        return [];
    }
  },

  getDetailedProgress: async (userId: string, courseId: string): Promise<Record<string, { completedAt: string }>> => {
    try {
        const docRef = doc(db, 'users', userId, 'course_progress', courseId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.lessonProgress) return data.lessonProgress;
            
            // Fallback para dados legados
            if (data.completedLessons) {
                const mockProgress: Record<string, { completedAt: string }> = {};
                data.completedLessons.forEach((id: string) => {
                    mockProgress[id] = { completedAt: new Date(0).toISOString() };
                });
                return mockProgress;
            }
        }
        return {};
    } catch {
        return {};
    }
  },

  // --- NOVAS FUNÇÕES PARA O PROGRESSO DO EDITAL VERTICALIZADO ---
  
  getCompletedTopics: async (userId: string, courseId: string) => {
    try {
      // Cria um documento único para o progresso do edital do aluno neste curso
      const progressRef = doc(db, 'course_edital_progress', `${userId}_${courseId}`);
      const snap = await getDoc(progressRef);
      if (snap.exists() && snap.data().completedTopics) {
        return snap.data().completedTopics;
      }
      return [];
    } catch (error) {
      console.error("Erro ao buscar tópicos concluídos:", error);
      return [];
    }
  },

  toggleTopicCompletion: async (userId: string, courseId: string, topicId: string, isCompleted: boolean) => {
    try {
      const progressRef = doc(db, 'course_edital_progress', `${userId}_${courseId}`);
      
      // Usa arrayUnion para adicionar ou arrayRemove para tirar o ID do tópico
      if (isCompleted) {
        await setDoc(progressRef, { completedTopics: arrayUnion(topicId) }, { merge: true });
      } else {
        await setDoc(progressRef, { completedTopics: arrayRemove(topicId) }, { merge: true });
      }
    } catch (error) {
      console.error("Erro ao alternar conclusão do tópico:", error);
    }
  },

  getCourseStats: async (courseId: string) => {
    try {
      const modules = await courseService.getModules(courseId);
      const moduleIds = modules.map(m => m.id);
      if (moduleIds.length === 0) return { totalLessons: 0 };
      
      let totalLessons = 0;
      const lessonsRef = collection(db, LESSONS_COLLECTION);
      for (const modId of moduleIds) {
          const q = query(lessonsRef, where('moduleId', '==', modId));
          const snapshot = await getCountFromServer(q);
          totalLessons += snapshot.data().count;
      }
      return { totalLessons };
    } catch {
      return { totalLessons: 0 };
    }
  },

  // --- EDITAL VERTICALIZADO ---
  
  getCourseEdital: async (courseId: string): Promise<CourseEditalStructure | null> => {
    try {
      const docRef = doc(db, EDITAL_COLLECTION, courseId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as CourseEditalStructure;
      }
      return null;
    } catch {
      return null;
    }
  },

  saveCourseEdital: async (data: CourseEditalStructure) => {
    try {
      const docRef = doc(db, EDITAL_COLLECTION, data.courseId);
      
      // SANITIZAÇÃO: Remove campos 'undefined' que quebram o Firestore
      // Usamos sanitizeData em vez de JSON.stringify para evitar erros de estrutura circular
      const sanitizedData = sanitizeData(data);

      await setDoc(docRef, {
        ...sanitizedData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao salvar edital:", error);
      throw error;
    }
  },

  // --- NOVOS MÉTODOS PARA VINCULAÇÃO E UPLOAD DO EDITAL ---

  // Retorna estrutura completa do curso (Módulos + Pastas + Aulas) para o modal de vinculação
  getCourseStructure: async (courseId: string): Promise<CourseStructureModule[]> => {
    try {
      // 1. Busca Módulos
      const modulesRef = collection(db, MODULES_COLLECTION);
      const qModules = query(modulesRef, where('courseId', '==', courseId), orderBy('order', 'asc'));
      const modulesSnap = await getDocs(qModules);

      const structure: CourseStructureModule[] = [];

      // Função Auxiliar para montar árvore de pastas recursivamente
      const buildFolderTree = (allFolders: CourseSubModule[], allLessons: CourseLesson[], parentId: string | null = null): CourseStructureFolder[] => {
        return allFolders
          .filter(f => (f.parentId || null) === parentId)
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(folder => ({
            ...folder,
            lessons: allLessons
              .filter(l => l.subModuleId === folder.id)
              .sort((a, b) => (a.order || 0) - (b.order || 0)),
            subfolders: buildFolderTree(allFolders, allLessons, folder.id)
          }));
      };

      // 2. Para cada módulo, busca pastas e aulas
      for (const modDoc of modulesSnap.docs) {
        const mod = { id: modDoc.id, ...modDoc.data() } as CourseModule;

        // Busca TODAS as pastas deste módulo
        const subRef = collection(db, SUBMODULES_COLLECTION);
        const qSub = query(subRef, where('moduleId', '==', mod.id));
        const subSnap = await getDocs(qSub);
        const allSubModules = subSnap.docs.map(d => ({ id: d.id, ...d.data() } as CourseSubModule));

        // Busca TODAS as aulas deste módulo
        const lessonsRef = collection(db, LESSONS_COLLECTION);
        const qLessons = query(lessonsRef, where('moduleId', '==', mod.id));
        const lessonsSnap = await getDocs(qLessons);
        const allLessons = lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() } as CourseLesson));

        // Monta a árvore relacional
        structure.push({
          ...mod,
          folders: buildFolderTree(allSubModules, allLessons, null),
          // Aulas que estão soltas no módulo (sem pasta)
          looseLessons: allLessons
            .filter(l => !l.subModuleId)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
        });
      }
      
      return structure;
    } catch (error) {
      console.error("Erro ao buscar estrutura do curso:", error);
      return [];
    }
  },

  // Upload de Material Específico do Edital
  uploadEditalFile: async (file: File, courseId: string, topicId: string): Promise<{url: string, path: string}> => {
      try {
        const uniqueName = `${Date.now()}_${file.name}`;
        // Path organizado por curso e tópico
        const path = `courses/${courseId}/edital_pdfs/${topicId}/${uniqueName}`;
        const storageRef = ref(storage, path);
        
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        
        return { url, path };
      } catch (error) {
        console.error("Erro upload PDF edital:", error);
        throw error;
      }
  },

  /**
   * Deleta todos os dados de progresso e revisões dos alunos vinculados a um tópico (ou lista de IDs).
   * Isso evita lixo no banco de dados e inconsistências na agenda do aluno.
   */
  cleanupStudentTopicData: async (courseId: string, topicIds: string[]) => {
    if (!courseId || topicIds.length === 0) return;

    try {
      // 1. Buscar o curso para pegar a lista de alunos matriculados
      const courseSnap = await getDoc(doc(db, COLLECTION_NAME, courseId));
      if (!courseSnap.exists()) return;
      
      const enrolledStudents = (courseSnap.data().enrolledStudents || []) as string[];
      if (enrolledStudents.length === 0) return;

      console.log(`[Cleanup] Iniciando limpeza de ${topicIds.length} tópicos para ${enrolledStudents.length} alunos.`);

      // 2. Processar alunos em lotes grandes (para evitar muitos commits individuais)
      let batch = writeBatch(db);
      let batchCount = 0;
      const BATCH_LIMIT = 450;

      for (const userId of enrolledStudents) {
        // A. Limpar progresso (completedTopics array)
        const progressRef = doc(db, 'course_edital_progress', `${userId}_${courseId}`);
        const progressSnap = await getDoc(progressRef);
        if (progressSnap.exists()) {
          const currentTopics = (progressSnap.data().completedTopics || []) as string[];
          const filteredTopics = currentTopics.filter(id => !topicIds.includes(id));
          if (filteredTopics.length !== currentTopics.length) {
            batch.update(progressRef, { completedTopics: filteredTopics });
            batchCount++;
          }
        }

        // B. Limpar revisões (Subcoleção users/userId/course_reviews)
        // O Firestore limita a cláusula 'in' a 10 valores. Processamos em fatias.
        const reviewsRef = collection(db, 'users', userId, 'course_reviews');
        
        for (let i = 0; i < topicIds.length; i += 10) {
          const chunk = topicIds.slice(i, i + 10);
          const qReviews = query(reviewsRef, where('topicId', 'in', chunk));
          const revSnap = await getDocs(qReviews);
          
          revSnap.docs.forEach(d => {
            batch.delete(d.ref);
            batchCount++;
          });

          // Verificar se o batch atingiu o limite dentro do loop de tópicos
          if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
      }

      // Commit final se sobrar algo
      if (batchCount > 0) {
        await batch.commit();
      }
      
      console.log(`[Cleanup] Limpeza de dados dos alunos concluída.`);
    } catch (error) {
      console.error("Erro ao limpar dados dos alunos após exclusão de tópico:", error);
    }
  },

  /**
   * Deleta recursivamente todos os recursos físicos (PDFs) de um tópico 
   * e de todos os seus subtópicos. Retorna a lista de todos os IDs de tópicos removidos.
   */
  deleteTopicResourcesRecursively: async (topic: any): Promise<string[]> => {
    let removedIds = [topic.id];

    // 1. Deletar PDFs deste tópico
    if (topic.materialPdfs && topic.materialPdfs.length > 0) {
      const deletePromises = topic.materialPdfs.map((pdf: any) => courseService.safeDeleteStorageFile(pdf.url));
      await Promise.all(deletePromises);
    }

    // 2. Recursividade para subtópicos
    if (topic.subtopics && topic.subtopics.length > 0) {
      for (const sub of topic.subtopics) {
        const subIds = await courseService.deleteTopicResourcesRecursively(sub);
        removedIds = [...removedIds, ...subIds];
      }
    }

    return removedIds;
  }
};

export const getAllOnlineCourses = async () => {
  try {
    const coursesRef = collection(db, 'online_courses');
    const q = query(coursesRef, orderBy('title', 'asc'));
    const snapshot = await getDocs(q);
    
    const courses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Para cada curso, buscamos sua estrutura (módulos e pastas)
    const coursesWithStructure = await Promise.all(courses.map(async (course: { id: string } & Partial<OnlineCourse>) => {
      const structure = await courseService.getCourseStructure(course.id);
      return {
        ...course,
        modules: structure
      };
    }));
    
    return coursesWithStructure;
  } catch (_error) {
    console.error("Erro ao buscar todos os cursos online:", _error);
    throw _error;
  }
};
