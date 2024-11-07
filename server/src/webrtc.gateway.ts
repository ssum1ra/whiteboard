import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class WebRTCGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private rooms = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);

    // 클라이언트가 속한 모든 방에 연결 종료 알림
    this.rooms.forEach((clients, roomId) => {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        client.to(roomId).emit('user-left', client.id);
        console.log(`Notified room ${roomId} about user ${client.id} leaving`);
      }
    });
  }

  // 방에 사용자 추가 및 현재 사용자 목록 전송
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`Client ${client.id} joining room: ${roomId}`);

    // 방 참여
    await client.join(roomId);

    // 방 사용자 목록 관리
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    const roomClients = this.rooms.get(roomId);

    // 현재 방에 있는 모든 사용자 목록 가져오기
    const currentUsers = Array.from(roomClients);

    // 신규 사용자에게 현재 방 사용자 목록 전송
    client.emit('room-users', currentUsers);
    console.log(`Sent current users to ${client.id}:`, currentUsers);

    // 방에 새 사용자 추가
    roomClients.add(client.id);

    // 방의 다른 사용자들에게 새 사용자 알림
    client.to(roomId).emit('user-joined', client.id);
    console.log(`Notified room about new user ${client.id}`);

    // 참여 완료 알림
    client.emit('joinedRoom', roomId);
  }

  @SubscribeMessage('offer')
  handleOffer(
    @MessageBody()
    data: {
      roomId: string;
      userId: string;
      offer: RTCSessionDescriptionInit;
    },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`Received offer from ${client.id} to ${data.userId}`);
    // userId로 특정 사용자에게만 offer 전송
    this.server.to(data.userId).emit('offer', {
      offer: data.offer,
      senderId: client.id,
    });
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @MessageBody()
    data: {
      roomId: string;
      userId: string;
      answer: RTCSessionDescriptionInit;
    },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`Received answer from ${client.id} to ${data.userId}`);
    // userId로 특정 사용자에게만 answer 전송
    this.server.to(data.userId).emit('answer', {
      answer: data.answer,
      senderId: client.id,
    });
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @MessageBody()
    data: {
      roomId: string;
      userId: string;
      candidate: RTCIceCandidateInit;
    },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`Received ICE candidate from ${client.id} to ${data.userId}`);
    // userId로 특정 사용자에게만 candidate 전송
    this.server.to(data.userId).emit('ice-candidate', {
      candidate: data.candidate,
      senderId: client.id,
    });
  }
}
