import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: false,
      whitelist: true,
    })
  )
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow('PORT');
  await app.listen(Number(port));
}
bootstrap();
