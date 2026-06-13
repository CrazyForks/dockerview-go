export interface Container {
  fullid: string;
  id: string;
  name: string;
  status: string;
  cpu: string;
  memory: string;
  blkio: string;
  network: string;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error';
}
