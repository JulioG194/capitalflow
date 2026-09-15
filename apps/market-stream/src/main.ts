import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);
  const origin = config.get('WEB_APP_ORIGIN');

  app.enableCors({
    origin,
    credentials: true,
  });

  const port = config.get('PORT');
  await app.listen(port);
}

void bootstrap();
