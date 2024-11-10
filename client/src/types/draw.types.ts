export interface DrawData {
  x: number;
  y: number;
  type: 'start' | 'draw' | 'end';
  userId: string;
}
