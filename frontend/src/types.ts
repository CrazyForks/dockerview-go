export interface Container {
  fullid: string;
  id: string;
  name: string;
  status: string;
  cpu: string;
  memory: string;
  blkio: string;
  network: string;
  healthscore?: number;
  healthstatus?: 'healthy' | 'warning' | 'dangerous';
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error';
}
