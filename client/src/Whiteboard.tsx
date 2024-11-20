import { useEffect, useRef } from "react";
import io from "socket.io-client";

type SocketType = SocketIOClient.Socket;

const Whiteboard: React.FC = () => {
  const socketRef = useRef<SocketType | null>(null);
  const socketRef2 = useRef<SocketType | null>(null);
  const socketRef3 = useRef<SocketType | null>(null);

  useEffect(() => {
    const prevPlayerId = localStorage.getItem('playerId');
    const prevRoomId = localStorage.getItem('roomId');

    socketRef.current = io("http://175.45.205.6:3000/game");
    socketRef2.current = io("http://175.45.205.6:3000/drawing", {
      auth: { roomId: prevRoomId, playerId: prevPlayerId}
    });
    socketRef3.current = io("http://175.45.205.6:3000/chat", {
      auth: { roomId: prevRoomId, playerId: prevPlayerId }
    });

    socketRef.current.on("connect", () => {
      console.log("connected");
      
      if (prevPlayerId && prevRoomId) {
        socketRef.current?.emit("reconnect", { 
          playerId: prevPlayerId,
          roomId: prevRoomId 
        });
      } else {
        socketRef.current?.emit("joinRoom", { 
          roomId: "c4357d05-a786-48c2-a7a3-2a1dffbd2fe9" 
        });
      }
    });

    socketRef2.current.on('connect', () => {
      console.log('Draw socket connected');
    });

    socketRef3.current.on('connect', () => {
      console.log('Chat socket connected');
    });

    socketRef.current.on('disconnect', () => {
      console.log('disconnected from server');
    });

    socketRef.current.on('joinedRoom', (data) => {
      console.log('joined room:', data);
      localStorage.setItem('playerId', data.playerId);
      localStorage.setItem('roomId', data.room.roomId);
    });
  
    socketRef.current.on('playerJoined', (data) => {
      console.log('received playerJoined:', data);
    });

    socketRef.current.on('playerLeft', (data) => {
      console.log('player left:', data);
      // 나간 플레이어가 호스트였고 내가 새 호스트가 되었다면
      if (data.room.hostId === localStorage.getItem('playerId')) {
        console.log('You are now the host!');
      }
    });

    socketRef2.current.on('drawUpdated', (data) => {
      console.log('drawUpdated:', data);
    });

    socketRef3.current.on('messageReceived', (data) => {
      console.log('messageReceived:', data);
    });
  }, []);

  const onClick = () => {
    socketRef2.current?.emit('draw', { drawingData: { x: 100, y: 100 } } );
  }

  const onClick2 = () => {
    socketRef3.current?.emit('sendMessage', { message: "hi" } );
  }

  return (
    <>
      <div>test</div>
      <button onClick={() => onClick()}>draw</button>
      <button onClick={() => onClick2()}>chat</button>
    </>
  );
};
export default Whiteboard;