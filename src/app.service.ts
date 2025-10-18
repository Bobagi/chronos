import { Injectable } from '@nestjs/common';

export interface ApplicationHomeSummary {
  message: string;
  documentationUrl: string;
  healthCheckUrl: string;
}

@Injectable()
export class AppService {
  getApplicationHomeSummary(): ApplicationHomeSummary {
    return {
      message: 'Chronos API is ready to accept requests.',
      documentationUrl: '/api',
      healthCheckUrl: '/game/test',
    };
  }
}
