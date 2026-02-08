import { existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

type SvelteKitHandler = (req: unknown, res: unknown) => void;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  app.enableCors({
    origin: process.env.CHRONOS_ALLOWED_ORIGINS?.split(',') ?? true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  });

  const config = new DocumentBuilder()
    .setTitle('Chronos API')
    .setDescription('Testing Chronos Game Backend')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await attachSvelteKit(app);

  const port = Number(process.env.PORT ?? process.env.CHRONOS_PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}
bootstrap();

async function attachSvelteKit(app: NestExpressApplication): Promise<void> {
  const clientBuildPath = join(__dirname, '..', 'client');
  const handlerPath = join(clientBuildPath, 'handler.js');
  if (!existsSync(handlerPath)) {
    return;
  }

  const { handler } = (await import(pathToFileURL(handlerPath).href)) as {
    handler: SvelteKitHandler;
  };

  app.useStaticAssets(join(clientBuildPath, 'client'));
  app.use(handler);
}
