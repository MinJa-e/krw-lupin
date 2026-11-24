import { createServer } from 'http';
import { Server } from 'socket.io';

const httpServer = createServer((request, response) => {
  const requestPath = request.url?.split('?')[0];
  if (requestPath !== '/health' && requestPath !== '/healthz') return;

  const commit = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null;
  const body = JSON.stringify({
    status: 'ok',
    service: 'krw-lupin',
    commit
  });

  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  response.end(body);
});

const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
});

// 접속한 플레이어 관리
const players = {};

io.on('connection', (socket) => {
  console.log('플레이어 접속:', socket.id);
  console.log('서버 연결 확인!');

  // 기존 플레이어 목록 전달
  socket.emit('currentPlayers', players);


  // 닉네임 변경 처리
  socket.on('setNickname', (data) => {
    console.log('서버에서 닉네임 변경 요청 수신:', data);

    if (!players[socket.id]) return;

    const nickname = String(data.nickname || '플레이어').trim().slice(0, 12);

    players[socket.id].nickname = nickname || '플레이어';

    // 모든 플레이어에게 변경된 닉네임 전달
    io.emit('nicknameChanged', {
      id: socket.id,
      nickname: players[socket.id].nickname
    });
  });

  // 캐릭터 색상 저장 및 전파
  socket.on('setAppearance', (data) => {
    if (!players[socket.id]) return;

    const appearance = {};
    const validParts = ['skin', 'hair', 'shirt', 'pants', 'shoes'];

    validParts.forEach((part) => {
      const value = data?.[part];
      if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) {
        appearance[part] = value;
      }
    });

    players[socket.id].appearance = appearance;

    io.emit('appearanceChanged', {
      id: socket.id,
      appearance
    });
  });


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
    const nickname = players[socket.id]?.nickname || '플레이어';
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
