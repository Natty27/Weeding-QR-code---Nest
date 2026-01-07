import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';
import { GuestSchema } from './guests.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Guest', schema: GuestSchema }]),
  ],
  controllers: [GuestsController],
  providers: [GuestsService],
})
export class GuestsModule {}
