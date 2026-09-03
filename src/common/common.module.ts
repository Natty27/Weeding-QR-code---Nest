import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonController } from './common.controller';
import { CommonService } from './common.service';
import { CommonSchema } from './common.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: 'Common', schema: CommonSchema }]),
  ],
  controllers: [CommonController],
  providers: [CommonService],
})
export class CommonModule {}
