import { Timestamp } from 'firebase/firestore';

export type PresentialEventLocation = 'POLO_RI' | 'POLO_PV' | 'OTHER';

export interface PresentialEventLot {
  id: string;
  name: string;
  type: 'DATE' | 'QUANTITY';
  value: number | string | Timestamp; // Date (Timestamp) or Quantity (number)
  price: number;
}

export interface PresentialEvent {
  id?: string;
  title: string;
  subtitle?: string;
  coverImage?: string;
  date: Timestamp | Date;
  startTime: string;
  locationType: PresentialEventLocation;
  customLocation?: string;
  totalTickets: number;
  useLots: boolean;
  lots?: PresentialEventLot[];
  status: 'ACTIVE' | 'FINISHED' | 'CANCELLED';
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface PresentialEventRegistration {
  id?: string;
  eventId: string;
  userId?: string;
  userName: string;
  userEmail: string;
  userCpf: string;
  userPhone: string;
  type: 'PAYING' | 'SCHOLARSHIP';
  lotId?: string;
  registeredAt: Timestamp | Date;
}
