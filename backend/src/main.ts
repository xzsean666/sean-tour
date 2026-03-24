import { NestFactory } from '@nestjs/core';
import { config } from './config';
import { AppModule } from './app.module';
import { CommonLogger } from './common/common-log.service';

function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => !!item);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new CommonLogger(),
  });
  const corsOrigins = parseCorsOrigins(config.http.CORS_ORIGIN);

  if (config.NODE_ENV !== 'production' || corsOrigins.length > 0) {
    app.enableCors({
      origin: corsOrigins.length > 0 ? corsOrigins : true,
      credentials: true,
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
