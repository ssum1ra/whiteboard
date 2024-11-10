import { Module } from '@nestjs/common';
import { RoomModule } from './room/room.module';
import { GameModule } from './game/game.module';

@Module({
  imports: [RoomModule, GameModule],
})
export class AppModule {}
