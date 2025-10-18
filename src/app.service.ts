import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface ApplicationHomeMetadata {
  message: string;
  documentationUrl: string;
  healthCheckUrl: string;
}

export const APPLICATION_HOME_METADATA: ApplicationHomeMetadata = {
  message: 'Chronos API is ready to accept requests.',
  documentationUrl: '/api',
  healthCheckUrl: '/game/test',
};

const APPLICATION_HOME_TEMPLATE_PATH = join(
  __dirname,
  'assets',
  'application-home.html',
);

let cachedTemplate: string | null = null;

function loadHomeTemplate(): string {
  if (cachedTemplate === null) {
    cachedTemplate = readFileSync(APPLICATION_HOME_TEMPLATE_PATH, 'utf8');
  }

  return cachedTemplate;
}

function applyMetadata(
  template: string,
  metadata: ApplicationHomeMetadata,
): string {
  return (Object.keys(metadata) as Array<keyof ApplicationHomeMetadata>).reduce(
    (accumulatedTemplate, key) => {
      const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');

      return accumulatedTemplate.replace(pattern, metadata[key]);
    },
    template,
  );
}

@Injectable()
export class AppService {
  getApplicationHomePage(): string {
    return applyMetadata(loadHomeTemplate(), APPLICATION_HOME_METADATA);
  }
}
