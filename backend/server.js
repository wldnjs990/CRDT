import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';

const PORT = process.env.PORT || 1234;

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws, req) => {
  // 클라이언트 정보 로깅
  const clientIp = req.socket.remoteAddress;
  const roomName = req.url?.slice(1) || 'default';
  console.log(`[연결] 클라이언트: ${clientIp}, 룸: ${roomName}`);

  // Yjs WebSocket 연결 설정
  setupWSConnection(ws, req);

  ws.on('close', () => {
    console.log(`[종료] 클라이언트: ${clientIp}, 룸: ${roomName}`);
  });
});

console.log(`
╔════════════════════════════════════════════╗
║       Yjs WebSocket 서버 시작됨            ║
╠════════════════════════════════════════════╣
║  포트: ${PORT}                              ║
║  URL:  ws://localhost:${PORT}               ║
╚════════════════════════════════════════════╝

프론트엔드에서 다음 URL로 연결하세요:
ws://localhost:${PORT}/[room-name]
`);
