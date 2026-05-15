export interface Folder {
  id: string;
  name: string;
  order: number;
}

export type CycleSystem = 'continuous' | 'rotative';

export interface CycleItem {
  id: string;
  type: 'discipline' | 'folder' | 'simulado';
  referenceId: string;
  topicsPerTurn: number;
  order: number;
  simuladoTitle?: string;
  duration?: number;
}

export interface Cycle {
  id: string;
  name: string;
  order: number;
  items: CycleItem[];
}

export interface Plan {
  id?: string;
  title: string;
  imageUrl: string;
  banners?: {
    today: { desktop: string; tablet: string; mobile: string };
    calendar: { desktop: string; tablet: string; mobile: string };
    edict: { desktop: string; tablet: string; mobile: string };
    mentorship: { desktop: string; tablet: string; mobile: string };
  };
  category: string;
  subcategory: string;
  organ: string;
  purchaseLink: string;
  folders?: Folder[];
  cycleSystem?: CycleSystem;
  cycles?: Cycle[];
  isEdictEnabled?: boolean;
  isActiveUserMode?: boolean;
  linkedSimuladoClassId?: string;
  simuladosVinculados?: string[];
  linkedMentors?: string[]; // IDs dos mentores vinculados
  isGenerationBlocked?: boolean;
  createdAt?: any;
  lastModifiedAt?: any;
  lastSyncedAt?: any;
  themeColor?: string;
}
