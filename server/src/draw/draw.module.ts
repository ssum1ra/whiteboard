import { Module } from '@nestjs/common';
import { DrawGateway } from './draw.gateway';
import { RoomModule } from '../room/room.module';

@Module({
  imports: [RoomModule],
  providers: [DrawGateway],
})
export class DrawModule {}
