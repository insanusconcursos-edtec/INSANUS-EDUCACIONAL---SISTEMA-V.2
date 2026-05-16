export interface Announcement {
  id: string;
  planId: string;
  title: string;
  content: string;
  forcePopUp: boolean;
  createdAt: number;
  readBy: string[]; // List of userId
}
