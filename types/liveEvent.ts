import { Timestamp } from 'firebase/firestore';

export interface LiveEventAccessControl {
  plans: string[];
  onlineCourses: string[];
  presentialClasses: string[];
  simulated: string[];
}

export interface LiveEventMaterial {
  id: string;
  title: string;
  url: string;
  order?: number;
}

export interface LiveEventRecording {
  id: string;
  title: string;
  url: string;
}

export interface LiveEventChatMessage {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  createdAt: Timestamp | any;
  isDeleted?: boolean;
}

export interface LiveChatMessage {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhoto?: string;
  senderName?: string;
  senderPhoto?: string;
  text: string;
  createdAt: any;
  isDeleted?: boolean; // Para moderação (apagar mensagem)
  isAdmin?: boolean;
  isEdited?: boolean;
  replyTo?: {
    id: string;
    userName: string;
    text: string;
  } | null;
}

export interface LiveActiveUser {
  userId: string;
  eventId: string;
  userName: string;
  userEmail: string;
  userPhoto?: string;
  joinedAt: any;
  isChatBlocked?: boolean; // Moderação
  isBanned?: boolean; // Moderação
}

export interface LiveEvent {
  id?: string;
  title: string;
  subtitle?: string;
  eventDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  thumbnailUrl?: string;
  videoUrl?: string; // Deprecated or keep for compatibility, but PRD asks for videoLink
  videoLink?: string; // Link Panda ou YouTube
  useAlternativePlayer?: boolean; // Máscara de segurança para YouTube
  isChatEnabled?: boolean;
  showViewers?: boolean;
  isIsolatedProduct: boolean;
  accessControl: LiveEventAccessControl;
  status: 'scheduled' | 'live' | 'ended';
  timezoneLocation?: string;
  materials?: LiveEventMaterial[];
  recordings?: LiveEventRecording[]; // Para produtos isolados
  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
}
