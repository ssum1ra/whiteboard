import { Module } from '@nestjs/common';
import { RoomModule } from './room/room.module';
import { SignalingModule } from './signaling/signaling.module';

@Module({
  imports: [RoomModule, SignalingModule],
})
export class AppModule {}
