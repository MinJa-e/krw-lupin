import { createServer } from 'http';
import { Server } from 'socket.io';

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
});

// 접속한 플레이어 관리
const players = {};

io.on('connection', (socket) => {
  console.log('플레이어 접속:', socket.id);

  // 기존 플레이어 목록 전달
  socket.emit('currentPlayers', players);

  // 신규 플레이어 등록
  players[socket.id] = {
    id: socket.id,
    x: 0,
    y: 0,
    z: 0,
    nickname: '플레이어'
  };

  socket.broadcast.emit('newPlayer', players[socket.id]);

  // 플레이어 이동 정보 전달
  socket.on('playerMovement', (data) => {
    if (!players[socket.id]) return;

    players[socket.id] = {
      ...players[socket.id],
      ...data
    };

    socket.broadcast.emit('playerMoved', players[socket.id]);
  });

  // 채팅 메시지 전달
  socket.on('chatMessage', (data) => {
    const nickname = String(data.nickname || '익명').slice(0, 12);
    const message = String(data.message || '').slice(0, 100);

    if (!message.trim()) return;
    io.emit('chatMessage', {
      id: socket.id,
      nickname,
      message
    });
  });

  // 플레이어 퇴장
  socket.on('disconnect', () => {
    console.log('플레이어 퇴장:', socket.id);

    delete players[socket.id];

    io.emit('playerDisconnected', socket.id);
  });
});

// 서버 실행
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`멀티플레이 서버 실행: ${PORT}`);
});