import { Module } from '@nestjs/common';
import { SignalingGateway } from './signaling.gateway';
import { RoomModule } from '../room/room.module';

@Module({
  imports: [RoomModule],
  providers: [SignalingGateway],
})
export class SignalingModule {}
