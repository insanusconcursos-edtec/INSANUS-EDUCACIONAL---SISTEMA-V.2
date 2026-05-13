export type ClassroomLocation = 'RIO_BRANCO' | 'PORTO_VELHO';
export type ClassroomStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';

export interface Classroom {
  id: string;
  name: string;
  location: ClassroomLocation;
  capacity: number;
  hasRecordingStructure: boolean;
  resources?: string[];
  status: ClassroomStatus;
  statusReason?: string;
  createdAt?: string;
  updatedAt?: string;
}
