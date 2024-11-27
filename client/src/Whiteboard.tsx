import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

type SocketType = SocketIOClient.Socket;

interface TimerState {
  startTime: number;
  duration: number;
  intervalId?: number;
}

const Whiteboard: React.FC = () => {
  const socketRef = useRef<SocketType | null>(null);
  const socketRef2 = useRef<SocketType | null>(null);
  const socketRef3 = useRef<SocketType | null>(null);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const timerRef = useRef<TimerState | null>(null);

  useEffect(() => {
    const prevPlayerId = localStorage.getItem('playerId');
    const prevRoomId = localStorage.getItem('roomId');

    socketRef.current = io("http://localhost:3000/game");
    socketRef2.current = io("http://localhost:3000/drawing", {
      auth: { roomId: prevRoomId, playerId: prevPlayerId}
    });
    socketRef3.current = io("http://localhost:3000/chat", {
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
          roomId: "2" 
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
      if (data.hostId === localStorage.getItem('playerId')) {
        console.log('You are now the host!');
      }
    });

    socketRef2.current.on('drawUpdated', (data) => {
      console.log('drawUpdated:', data);
    });

    socketRef3.current.on('messageReceived', (data) => {
      console.log('messageReceived:', data);
    });

    socketRef.current.on('settingsUpdated', (data) => {
      console.log('settingsUpdated:', data.settings);
    });

    socketRef.current.on('drawingGroupRoundStarted', (data) => {
      console.log('drawingGroupRoundStarted:', data);
      startLocalTimer(Date.now(), data.drawTime * 1000);
    })

    socketRef.current.on('guesserRoundStarted', (data) => {
      console.log('guesserRoundStarted:', data);
      startLocalTimer(Date.now(), data.drawTime * 1000);
    })

    socketRef.current.on('timerSync', (data) => {
      console.log('Timer sync:', data);
      const localRemaining = timerRef.current 
        ? Math.max(0, timerRef.current.duration - (Date.now() - timerRef.current.startTime))
        : 0;
      
      // 1초 이상 차이나면 보정
      if (Math.abs(localRemaining - data.remaining) > 1000) {
        const newStartTime = Date.now() - (timerRef.current?.duration || 0) + data.remaining;
        startLocalTimer(newStartTime, timerRef.current?.duration || 0);
      }
    });

    socketRef.current.on('drawingTimeEnded', (data) => {
      console.log('drawingTimeEnded', data);
      if (timerRef.current?.intervalId) {
        clearInterval(timerRef.current.intervalId);
      }
      timerRef.current = null;
      setRemainingTime(0);
      startLocalTimer(Date.now(), 10 * 1000);
    });

    socketRef.current.on('roundEnded', (data) => {
      console.log('roundEnded:', data);
      if (timerRef.current?.intervalId) {
        clearInterval(timerRef.current.intervalId);
      }
      timerRef.current = null;
      setRemainingTime(0);
      startLocalTimer(Date.now(), 10 * 1000);
    });

    socketRef.current.on('gameEnded', () => {
      console.log('gameEnded');
      if (timerRef.current?.intervalId) {
        clearInterval(timerRef.current.intervalId);
      }
      timerRef.current = null;
      setRemainingTime(0);
    });

    socketRef.current.on('submitDrawing', () => {
      socketRef.current?.emit('submittedDrawing', { drawing: 'drawing'})
    })
  }, []);

  const onClick = () => {
    socketRef2.current?.emit('draw', { drawingData: { x: 100, y: 100 } } );
  }

  const onClick2 = () => {
    socketRef3.current?.emit('sendMessage', { message: "hi" } );
  }

  const onClick3 = () => {
    socketRef.current?.emit('updateSettings', { settings: { maxPlayers: 20 } });
  }

  const startLocalTimer = (startTime: number, duration: number) => {
    if (timerRef.current?.intervalId) {
      window.clearInterval(timerRef.current.intervalId);
    }

    timerRef.current = {
      startTime,
      duration
    };

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTime;
      const remaining = Math.max(0, duration - elapsed);
      
      setRemainingTime(Math.ceil(remaining / 1000));

      if (remaining <= 0) {
        window.clearInterval(intervalId);
        timerRef.current = null;
      }
    }, 100);

    timerRef.current.intervalId = intervalId;
  };

  const onClick4 = () => {
    socketRef.current?.emit('gameStart');
  }

  const handleSubmitGuess = (answer: string) => {
    console.log('submitting guess:', answer);
    socketRef.current?.emit('checkAnswer', { answer });
  };

  return (
    <>
      <div>test</div>
      <div>Remaining Time: {remainingTime}s</div>
      <button onClick={() => onClick()}>draw</button>
      <button onClick={() => onClick2()}>chat</button>
      <button onClick={() => onClick3()}>updateSettings</button>
      <button onClick={() => onClick4()}>gameStart</button>
      <input 
        type="text"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSubmitGuess(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
      />
    </>
  );
};
export default Whiteboard;