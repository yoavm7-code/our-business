import { NestFactory } from '@nestjs/core';
import {
  ValidationPipe,
  Logger,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

// Log every process-level crash
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

// Global filter: catch ALL errors, log them, return proper HTTP response (prevent 502)
@Catch()
class GlobalExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message: exception?.message || 'Internal server error' };

    this.logger.error(
      `${request.method} ${request.url} → ${status}: ${exception?.message}`,
      exception?.stack,
    );

    response.status(status).json(
      typeof message === 'string' ? { statusCode: status, message } : message,
    );
  }
}

async function bootstrap() {
  console.log('Starting NestJS application...');
  console.log(`NODE_ENV=${process.env.NODE_ENV}`);
  console.log(`PORT=${process.env.PORT}`);
  console.log(`DATABASE_URL=${process.env.DATABASE_URL ? '***set***' : 'NOT SET'}`);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Global exception filter - catches EVERYTHING
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS - permissive for now to eliminate as a failure cause
  app.enableCors({
    origin: true,
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

  // Health check - raw Express, bypasses all NestJS middleware/guards
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/health', (_req: any, res: any) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`NestJS application listening on 0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error('BOOTSTRAP FAILED:', err);
  process.exit(1);
});
