import { Timestamp } from 'firebase/firestore';

export interface Mentor {
  id: string;
  name: string;
  photoUrl: string;
  createdAt: Timestamp | any;
}

export type SenderRole = 'student' | 'mentor';

export interface Message {
  id: string;
  senderId: string;
  senderRole: SenderRole;
  text: string;
  timestamp: Timestamp | any;
  isEdited?: boolean;
  isDeleted?: boolean;
  imageUrl?: string;
  replyToId?: string;
  replyToText?: string;
}

export interface Call {
  id: string;
  planId: string;
  studentId: string;
  studentName: string;
  studentPhotoUrl?: string;
  mentorId: string;
  mentorName: string;
  mentorPhotoUrl?: string;
  lastMessage: string;
  lastMessageTime: Timestamp | any;
  unreadCount: number;
}
