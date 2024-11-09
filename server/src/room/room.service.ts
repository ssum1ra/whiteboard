import { Injectable } from '@nestjs/common';
import { DrawData, ChatMessage } from '../types/draw.types';

@Injectable()
export class RoomService {
  private rooms = new Map<string, Set<string>>();
  private drawHistory = new Map<string, DrawData[]>();
  private chatHistory = new Map<string, ChatMessage[]>();

  joinRoom(roomId: string, userId: string) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
      this.drawHistory.set(roomId, []);
      this.chatHistory.set(roomId, []);
    }
    this.rooms.get(roomId)?.add(userId);
    return {
      drawings: this.drawHistory.get(roomId) || [],
      messages: this.chatHistory.get(roomId) || [],
    };
  }

  leaveRoom(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(userId);
      if (room.size === 0) {
        this.rooms.delete(roomId);
        this.drawHistory.delete(roomId);
        this.chatHistory.delete(roomId);
      }
    }
  }

  addDrawData(roomId: string, data: DrawData) {
    const history = this.drawHistory.get(roomId);
    if (history) {
      history.push(data);
    }
  }

  addChatMessage(roomId: string, message: ChatMessage) {
    const history = this.chatHistory.get(roomId);
    if (history) {
      history.push(message);
    }
  }
}
