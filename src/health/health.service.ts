import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
  timestamp: string;
  uptimeInSeconds: number;
}

@Injectable()
export class HealthService {
  getHealthStatus(): HealthStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeInSeconds: Math.round(process.uptime()),
    };
  }
}
