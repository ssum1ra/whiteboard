import { Module } from '@nestjs/common';
import { RoomModule } from './room/room.module';
import { DrawModule } from './draw/draw.module';

@Module({
  imports: [RoomModule, DrawModule],
})
export class AppModule {}
