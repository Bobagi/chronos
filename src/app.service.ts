import { Injectable } from '@nestjs/common';

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

@Injectable()
export class AppService {
  getApplicationHomePage(): string {
    const { message, documentationUrl, healthCheckUrl } =
      APPLICATION_HOME_METADATA;

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Chronos API</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 3rem; color: #1a202c; }
      main { max-width: 40rem; }
      h1 { font-size: 2rem; margin-bottom: 1rem; }
      p { margin-bottom: 1.5rem; line-height: 1.5; }
      a { color: #2563eb; text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <main>
      <h1>Chronos API</h1>
      <p>${message}</p>
      <p>
        <strong>Documentation:</strong>
        <a href="${documentationUrl}">${documentationUrl}</a>
      </p>
      <p>
        <strong>Health check:</strong>
        <a href="${healthCheckUrl}">${healthCheckUrl}</a>
      </p>
    </main>
  </body>
</html>`;
  }
}
