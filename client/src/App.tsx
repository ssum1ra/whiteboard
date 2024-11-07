import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const SOCKET_SERVER = import.meta.env.VITE_SOCKET_SERVER;

type SocketType = ReturnType<typeof io>;

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const socketRef = useRef<SocketType>();
  const [isDrawing, setIsDrawing] = useState(false);
  const myIdRef = useRef<string>('');

  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER, {
      transports: ['websocket'],
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to server');
      myIdRef.current = socketRef.current?.id || '';
      socketRef.current?.emit('joinRoom', 'canvas-room');
    });

    // 방에 참여했을 때 현재 방에 있는 다른 유저들의 목록을 받음
    socketRef.current.on('room-users', (users: string[]) => {
      console.log('Current users in room:', users);
      // 자신을 제외한 각 유저와 연결 설정
      users.forEach(userId => {
        if (userId !== myIdRef.current && !peerConnections.current.has(userId)) {
          createPeerConnection(userId, true);
        }
      });
    });

    socketRef.current.on('joinedRoom', (message: string) => {
      console.log('Successfully joined room:', message);
      // 여기에 방에 성공적으로 입장했을 때 수행할 추가 작업을 넣을 수 있습니다.
    });

    // 새로운 유저가 들어왔을 때
    socketRef.current.on('user-joined', (userId: string) => {
      console.log('New user joined:', userId);
      if (userId !== myIdRef.current && !peerConnections.current.has(userId)) {
        // 새로운 유저가 들어왔을 때는 기존 유저들이 연결을 시작하지 않음
        // 새로운 유저가 각 기존 유저에게 연결을 시작할 것임
        createPeerConnection(userId, false);
      }
    });

    socketRef.current.on('offer', async ({ offer, senderId } : { offer: RTCSessionDescriptionInit; senderId: string }) => {
      console.log('Received offer from:', senderId);
      await handleOffer(offer, senderId);
    });

    socketRef.current.on('answer', async ({ answer, senderId } : { answer: RTCSessionDescriptionInit; senderId: string }) => {
      console.log('Received answer from:', senderId);
      await handleAnswer(answer, senderId);
    });

    socketRef.current.on('ice-candidate', async ({ candidate, senderId } : { candidate: RTCIceCandidateInit; senderId: string }) => {
      await handleIceCandidate(candidate, senderId);
    });

    socketRef.current.on('user-left', (userId: string) => {
      console.log('User left:', userId);
      cleanupPeerConnection(userId);
    });

    return () => {
      peerConnections.current.forEach((_, userId) => {
        cleanupPeerConnection(userId);
      });
      socketRef.current?.disconnect();
    };
  }, []);

  const cleanupPeerConnection = (userId: string) => {
    const peerConnection = peerConnections.current.get(userId);
    if (peerConnection) {
      peerConnection.close();
      peerConnections.current.delete(userId);
    }
    
    const dataChannel = dataChannels.current.get(userId);
    if (dataChannel) {
      dataChannel.close();
      dataChannels.current.delete(userId);
    }
    
    pendingCandidates.current.delete(userId);
  };

  const createPeerConnection = (userId: string, initiator: boolean): RTCPeerConnection => {
    console.log(`Creating peer connection with ${userId} (initiator: ${initiator})`);
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'turn:relay.metered.ca:80',
          username: 'openai',
          credential: 'openai'
        },
        {
          urls: 'turn:relay.metered.ca:443',
          username: 'openai',
          credential: 'openai'
        },
        {
          urls: 'turn:relay.metered.ca:443?transport=tcp',
          username: 'openai',
          credential: 'openai'
        }
      ],
      iceTransportPolicy: 'relay',
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to:', userId);
        socketRef.current?.emit('ice-candidate', {
          candidate: event.candidate,
          roomId: 'canvas-room',
          userId
        });
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE Connection State with ${userId}: ${peerConnection.iceConnectionState}`);
    };

    peerConnection.ondatachannel = (event) => {
      console.log('Received data channel from:', userId);
      const dataChannel = event.channel;
      dataChannels.current.set(userId, dataChannel);
      setupDataChannelListeners(dataChannel, userId);
    };

    if (initiator) {
      console.log('Creating data channel as initiator for:', userId);
      const dataChannel = peerConnection.createDataChannel("canvas", {
        ordered: true
      });
      dataChannels.current.set(userId, dataChannel);
      setupDataChannelListeners(dataChannel, userId);
      
      // Initiator creates and sends offer
      createAndSendOffer(peerConnection, userId);
    }

    peerConnections.current.set(userId, peerConnection);
    return peerConnection;
  };

  const createAndSendOffer = async (peerConnection: RTCPeerConnection, userId: string) => {
    try {
      const offer = await peerConnection.createOffer();
      console.log('Created offer for:', userId);
      await peerConnection.setLocalDescription(offer);
      console.log('Set local description (offer) for:', userId);
      
      socketRef.current?.emit('offer', {
        offer,
        roomId: 'canvas-room',
        userId
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit, userId: string) => {
    try {
      let peerConnection = peerConnections.current.get(userId);
      if (!peerConnection) {
        console.log('Creating new peer connection for offer from:', userId);
        peerConnection = createPeerConnection(userId, false);
      }

      if (peerConnection.signalingState !== "stable") {
        console.log('Ignoring offer in non-stable state');
        return;
      }

      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('Set remote description (offer) for:', userId);
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log('Set local description (answer) for:', userId);
      
      socketRef.current?.emit('answer', {
        answer,
        roomId: 'canvas-room',
        userId
      });

      // Process any pending ICE candidates
      const candidates = pendingCandidates.current.get(userId) || [];
      for (const candidate of candidates) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidates.current.delete(userId);
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit, userId: string) => {
    try {
      const peerConnection = peerConnections.current.get(userId);
      if (!peerConnection) {
        console.error('No peer connection found for user:', userId);
        return;
      }

      const currentState = peerConnection.signalingState;
      console.log(`Current signaling state for ${userId}:`, currentState);

      if (currentState === "stable") {
        console.log('Connection already stable with:', userId);
        return;
      }

      if (currentState !== "have-local-offer") {
        console.log(`Unexpected signaling state ${currentState} for answer from:`, userId);
        return;
      }

      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Set remote description (answer) for:', userId);
      
      // Process any pending ICE candidates
      const candidates = pendingCandidates.current.get(userId) || [];
      for (const candidate of candidates) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidates.current.delete(userId);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit, userId: string) => {
    try {
      const peerConnection = peerConnections.current.get(userId);
      if (!peerConnection) {
        console.log('No peer connection found for ICE candidate from:', userId);
        return;
      }

      if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
        console.log('Adding ICE candidate for:', userId);
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        console.log('Queueing ICE candidate for:', userId);
        if (!pendingCandidates.current.has(userId)) {
          pendingCandidates.current.set(userId, []);
        }
        pendingCandidates.current.get(userId)?.push(candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  const setupDataChannelListeners = (dataChannel: RTCDataChannel, userId: string) => {
    dataChannel.onopen = () => {
      console.log(`Data channel opened with ${userId}`);
    };
    
    dataChannel.onclose = () => {
      console.log(`Data channel closed with ${userId}`);
    };
    
    dataChannel.onerror = (error) => {
      console.error(`Data channel error with ${userId}:`, error);
    };
    
    dataChannel.onmessage = (event) => {
      const { type, x, y } = JSON.parse(event.data);
      handleRemoteDrawing(type, x, y);
    };
  };

  const handleRemoteDrawing = (type: string, x: number, y: number) => {
    if (!canvasRef.current) return;
    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    if (type === 'start') {
      context.beginPath();
      context.moveTo(x, y);
    } else if (type === 'draw') {
      context.lineTo(x, y);
      context.stroke();
    }
  };

  const startDrawing = ({ nativeEvent }: React.MouseEvent) => {
    const { offsetX, offsetY } = nativeEvent;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    
    context.beginPath();
    context.moveTo(offsetX, offsetY);
    setIsDrawing(true);
    sendDrawingData('start', offsetX, offsetY);
  };

  const draw = ({ nativeEvent }: React.MouseEvent) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    
    context.lineTo(offsetX, offsetY);
    context.stroke();
    sendDrawingData('draw', offsetX, offsetY);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const sendDrawingData = (type: string, x: number, y: number) => {
    const message = JSON.stringify({ type, x, y });
    dataChannels.current.forEach((dataChannel) => {
      if (dataChannel.readyState === "open") {
        dataChannel.send(message);
      }
    });
  };

  return (
    <div className="p-4">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border bg-gray-100"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />
    </div>
  );
}

export default App;