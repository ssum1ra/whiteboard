import { Module } from '@nestjs/common';
import { WebRTCGateway } from './webrtc.gateway';

@Module({
  providers: [WebRTCGateway],
})
export class AppModule {}
