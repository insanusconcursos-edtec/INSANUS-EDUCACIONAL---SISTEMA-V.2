
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { EdictStructure } from '../services/edictService';
import { Meta } from '../services/metaService';
import { getStudentCompletedMetas } from '../services/scheduleService';
import { useAuth } from './AuthContext';

interface EdictDataState {
    structure: EdictStructure | null;
    completedMetaIds: Set<string>;
    planTitle: string;
    activeUserMode: boolean;
    planId: string | null;
    metaLookup: Record<string, Meta>;
    fullPlanData: any;
}

interface EdictDataContextType {
    data: EdictDataState | null;
    setData: (data: EdictDataState) => void;
    clearData: () => void;
}

const EdictDataContext = createContext<EdictDataContextType | undefined>(undefined);

export const EdictDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const [data, setEdictData] = useState<EdictDataState | null>(null);

    // Listener para atualização global de metas concluídas (vindo do Timer ou outras fontes)
    useEffect(() => {
        const handleGlobalFinished = async (e: any) => {
            if (!currentUser || !data || !data.planId) return;
            
            const { planId, goalId, status } = e.detail;
            if (planId === data.planId) {
                // 1. Atualização Otimista Imediata
                if (goalId && status === 'completed') {
                    console.log(`♻️ [EdictData] Atualização otimista: ${goalId}`);
                    setEdictData(prev => {
                        if (!prev) return null;
                        const nextIds = new Set(prev.completedMetaIds);
                        nextIds.add(goalId);
                        return { ...prev, completedMetaIds: nextIds };
                    });
                }

                // 2. Sincronização em background com o servidor para garantir integridade
                console.log("♻️ [EdictData] Sincronizando metas concluídas via Global Event...");
                try {
                    const freshCompletedIds = await getStudentCompletedMetas(currentUser.uid, planId);
                    setEdictData(prev => prev ? { ...prev, completedMetaIds: freshCompletedIds } : null);
                } catch (error) {
                    console.error("Erro ao sincronizar cache do edital:", error);
                }
            }
        };

        window.addEventListener('study-goal-finished', handleGlobalFinished);
        return () => window.removeEventListener('study-goal-finished', handleGlobalFinished);
    }, [currentUser, data?.planId]);

    const setData = (newData: EdictDataState) => {
        setEdictData(newData);
    };

    const clearData = () => {
        setEdictData(null);
    };

    return (
        <EdictDataContext.Provider value={{ data, setData, clearData }}>
            {children}
        </EdictDataContext.Provider>
    );
};

export const useEdictData = () => {
    const context = useContext(EdictDataContext);
    if (context === undefined) {
        throw new Error('useEdictData must be used within an EdictDataProvider');
    }
    return context;
};
