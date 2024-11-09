export interface DrawData {
  x: number;
  y: number;
  type: 'start' | 'draw' | 'end';
}

export interface ChatMessage {
  userId: string;
  message: string;
  timestamp: number;
}
