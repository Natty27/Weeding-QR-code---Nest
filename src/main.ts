import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
  });

  const port = process.env.PORT || 47311;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
