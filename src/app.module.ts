import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiController, AiService, AiCourseService } from './ai';
import { PlacesModule } from './places';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PlacesModule,
  ],
  controllers: [AppController, AiController],
  providers: [AppService, AiService, AiCourseService],
})
export class AppModule {}
