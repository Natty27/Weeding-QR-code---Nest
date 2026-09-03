import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';
import { GuestSchema } from './guests.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: 'Guest', schema: GuestSchema }]),
  ],
  controllers: [GuestsController],
  providers: [GuestsService],
})
export class GuestsModule {}
