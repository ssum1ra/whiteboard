import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomService } from '../room/room.service';
import { DrawData } from '../types/draw.types';
import { ChatMessage } from 'src/types/chat.types';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly roomService: RoomService) {}

  @SubscribeMessage('joinRoom')
  handleJoinRoom(client: Socket, roomId: string) {
    const history = this.roomService.joinRoom(roomId, client.id);
    client.join(roomId);
    return history;
  }

  @SubscribeMessage('draw')
  handleDraw(client: Socket, data: { roomId: string; drawData: DrawData }) {
    const { roomId, drawData } = data;
    this.roomService.addDrawData(roomId, drawData);
    client.to(roomId).emit('draw', drawData);
  }

  @SubscribeMessage('chat')
  handleChat(client: Socket, data: { roomId: string; message: ChatMessage }) {
    const { roomId, message } = data;
    this.roomService.addChatMessage(roomId, message);
    // 메시지를 보낸 클라이언트를 포함한 모든 클라이언트에게 전송
    this.server.to(roomId).emit('chat', message);
  }

  handleDisconnect(client: Socket) {
    const rooms = Array.from(client.rooms.values()).filter(
      (room) => room !== client.id,
    );
    rooms.forEach((roomId) => {
      this.roomService.leaveRoom(roomId, client.id);
    });
  }

  handleConnection(client: Socket) {
    console.log(`client connected: ${client.id}`);
  }
}
