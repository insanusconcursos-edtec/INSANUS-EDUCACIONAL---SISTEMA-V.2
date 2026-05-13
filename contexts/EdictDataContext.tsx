
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { EdictStructure } from '../services/edictService';
import { Meta } from '../services/metaService';

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
    const [data, setEdictData] = useState<EdictDataState | null>(null);

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
