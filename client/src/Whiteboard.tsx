import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

export interface DrawData {
    x: number;
    y: number;
    type: 'start' | 'draw' | 'end';
  }
  
  export interface ChatMessage {
    userId: string;
    message: string;
    timestamp: number;
  }
  
type SocketType = ReturnType<typeof io>;


const Whiteboard: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);
    const [socket, setSocket] = useState<SocketType>();
    const [isDrawing, setIsDrawing] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [userId] = useState(`user-${Math.random().toString(36).substr(2, 9)}`);
    const chatRef = useRef<HTMLDivElement>(null);
  
    // Socket 연결 설정
    useEffect(() => {
      const newSocket = io('http://localhost:3000');
      setSocket(newSocket);
  
      return () => {
        newSocket.disconnect();
      };
    }, []);
  
    // Socket 이벤트 리스너 설정
    useEffect(() => {
      if (!socket) return;
  
      // 그리기 이벤트 리스너
      socket.on('draw', (drawData: DrawData) => {
        if (!contextRef.current) return;
        
        switch(drawData.type) {
          case 'start':
            contextRef.current.beginPath();
            contextRef.current.moveTo(drawData.x, drawData.y);
            break;
          case 'draw':
            contextRef.current.lineTo(drawData.x, drawData.y);
            contextRef.current.stroke();
            break;
          case 'end':
            contextRef.current.closePath();
            break;
        }
      });
  
      // 채팅 메시지 수신
      socket.on('chat', (message: ChatMessage) => {
        setMessages(prev => [...prev, message]);
        // 새 메시지가 오면 스크롤을 아래로
        setTimeout(() => {
          if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
          }
        }, 0);
      });
  
      return () => {
        socket.off('draw');
        socket.off('chat');
      };
    }, [socket]);
  
    // Canvas 초기 설정
    useEffect(() => {
      if (!canvasRef.current) return;
  
      const canvas = canvasRef.current;
      canvas.width = 800;
      canvas.height = 600;
  
      const context = canvas.getContext('2d');
      if (!context) return;
  
      context.strokeStyle = 'black';
      context.lineWidth = 2;
      context.lineCap = 'round';
      contextRef.current = context;
  
      if (socket) {
        // Room 참가
        socket.emit('joinRoom', 'default-room');
      }
    }, [socket]);
  
    // 그리기 관련 함수들...
    const getCoordinates = (event: React.MouseEvent): [number, number] => {
      if (!canvasRef.current) return [0, 0];
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      return [
        event.clientX - rect.left,
        event.clientY - rect.top
      ];
    };
  
    const startDrawing = (event: React.MouseEvent) => {
      if (!socket || !contextRef.current) return;
      setIsDrawing(true);
      const [x, y] = getCoordinates(event);
      
      contextRef.current.beginPath();
      contextRef.current.moveTo(x, y);
      
      socket.emit('draw', {
        roomId: 'default-room',
        drawData: { x, y, type: 'start' as const }
      });
    };
  
    const draw = (event: React.MouseEvent) => {
      if (!isDrawing || !socket || !contextRef.current) return;
      const [x, y] = getCoordinates(event);
      
      contextRef.current.lineTo(x, y);
      contextRef.current.stroke();
      
      socket.emit('draw', {
        roomId: 'default-room',
        drawData: { x, y, type: 'draw' as const }
      });
    };
  
    const stopDrawing = () => {
      if (!socket || !contextRef.current || !isDrawing) return;
      setIsDrawing(false);
      contextRef.current.closePath();
      
      socket.emit('draw', {
        roomId: 'default-room',
        drawData: { x: 0, y: 0, type: 'end' as const }
      });
    };
  
    // 채팅 관련 함수
    const handleMessageSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!socket || !newMessage.trim()) return;
  
      const messageData: ChatMessage = {
        userId,
        message: newMessage.trim(),
        timestamp: Date.now()
      };
  
      socket.emit('chat', {
        roomId: 'default-room',
        message: messageData
      });
  
      setNewMessage("");
    };
  
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
        <div className="flex gap-4">
          <div>
            <h1 className="text-2xl mb-4 text-center">실시간 그림판</h1>
            <canvas
              ref={canvasRef}
              className="bg-white border border-gray-300 cursor-crosshair"
              style={{ touchAction: 'none' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
          </div>
          
          <div className="w-80">
            <h2 className="text-xl mb-4">채팅</h2>
            <div 
              ref={chatRef}
              className="bg-white border border-gray-300 p-4 h-[600px] mb-4 overflow-y-auto"
            >
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`mb-2 ${msg.userId === userId ? 'text-right' : ''}`}
                >
                  <div className="text-sm text-gray-500">{msg.userId}</div>
                  <div className={`inline-block p-2 rounded-lg ${
                    msg.userId === userId ? 
                    'bg-blue-500 text-white' : 
                    'bg-gray-200'
                  }`}>
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleMessageSubmit} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded"
                placeholder="메시지를 입력하세요..."
              />
              <button 
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                전송
              </button>
            </form>
          </div>
        </div>
      </div>
    );
};

export default Whiteboard;