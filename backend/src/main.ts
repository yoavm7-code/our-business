import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

// Catch process-level crashes so we can see what kills the process
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, err.stack);
});
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS - allow all origins in production for now (Railway generates dynamic URLs)
  const frontendUrl = process.env.FRONTEND_URL;
  app.enableCors({
    origin: frontendUrl ? frontendUrl.split(',') : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Simple health check that bypasses all NestJS guards/middleware
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/health', (_req: any, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Freelancer Finance API running on 0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  logger.error(`Failed to start application: ${err.message}`, err.stack);
  process.exit(1);
});
