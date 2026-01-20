/**
 * y-websocket 없이 순수 WebSocket으로 Yjs CRDT 동기화하는 서버
 *
 * 메시지 프로토콜:
 * - byte[0] = 메시지 타입 (0: stateVector, 1: update)
 * - byte[1:] = 페이로드 (Yjs 바이너리)
 */

import { WebSocketServer } from 'ws';
import * as Y from 'yjs';

const PORT = process.env.PORT || 1234;

// 룸별 Y.Doc 저장소
const rooms = new Map();

// 룸별 클라이언트 목록
const roomClients = new Map();

// 룸의 Y.Doc 가져오기 (없으면 생성)
function getRoom(roomName) {
  if (!rooms.has(roomName)) {
    const ydoc = new Y.Doc();
    rooms.set(roomName, ydoc);
    roomClients.set(roomName, new Set());
    console.log(`[룸 생성] ${roomName}`);
  }
  return rooms.get(roomName);
}

// 룸의 클라이언트 목록 가져오기
function getRoomClients(roomName) {
  if (!roomClients.has(roomName)) {
    roomClients.set(roomName, new Set());
  }
  return roomClients.get(roomName);
}

// 특정 클라이언트 제외하고 브로드캐스트
function broadcastToRoom(roomName, message, excludeWs) {
  const clients = getRoomClients(roomName);
  clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === 1) {
      client.send(message);
    }
  });
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  const roomName = req.url?.slice(1) || 'default';

  console.log(`[연결] 클라이언트: ${clientIp}, 룸: ${roomName}`);

  // 클라이언트를 룸에 추가
  const clients = getRoomClients(roomName);
  clients.add(ws);

  // 룸의 Y.Doc 가져오기
  const ydoc = getRoom(roomName);

  // Y.Doc 변경 시 다른 클라이언트에게 브로드캐스트
  const updateHandler = (update, origin) => {
    // 이 클라이언트에서 온 변경은 다시 보내지 않음
    if (origin === ws) return;

    const message = new Uint8Array(update.length + 1);
    message[0] = 1; // type: update
    message.set(update, 1);

    if (ws.readyState === 1) {
      ws.send(message);
    }
  };

  ydoc.on('update', updateHandler);

  ws.on('message', (data) => {
    try {
      const message = new Uint8Array(data);
      const messageType = message[0];
      const payload = message.slice(1);

      if (messageType === 0) {
        // stateVector 수신 → 부족한 업데이트 전송
        const update = Y.encodeStateAsUpdate(ydoc, payload);
        if (update.length > 0) {
          const response = new Uint8Array(update.length + 1);
          response[0] = 1; // type: update
          response.set(update, 1);
          ws.send(response);
        }

        // 서버도 클라이언트에게 stateVector 요청 (양방향 동기화)
        const serverStateVector = Y.encodeStateVector(ydoc);
        const request = new Uint8Array(serverStateVector.length + 1);
        request[0] = 0; // type: stateVector
        request.set(serverStateVector, 1);
        ws.send(request);

      } else if (messageType === 1) {
        // update 수신 → Y.Doc에 적용 & 다른 클라이언트에 브로드캐스트
        Y.applyUpdate(ydoc, payload, ws);

        // 다른 클라이언트에게 브로드캐스트
        broadcastToRoom(roomName, data, ws);
      }
    } catch (error) {
      console.error('[메시지 처리 에러]', error);
    }
  });

  ws.on('close', () => {
    console.log(`[종료] 클라이언트: ${clientIp}, 룸: ${roomName}`);

    // 클라이언트 제거
    clients.delete(ws);

    // 이벤트 핸들러 제거
    ydoc.off('update', updateHandler);

    // 빈 룸 정리 (선택적)
    if (clients.size === 0) {
      // 여기서 룸을 삭제하지 않음 (상태 유지)
      // 필요시 아래 주석 해제
      // rooms.delete(roomName);
      // roomClients.delete(roomName);
      // console.log(`[룸 삭제] ${roomName}`);
    }
  });

  ws.on('error', (error) => {
    console.error(`[WebSocket 에러] ${clientIp}:`, error);
  });
});

console.log(`
╔════════════════════════════════════════════╗
║   순수 WebSocket CRDT 서버 (y-websocket X) ║
╠════════════════════════════════════════════╣
║  포트: ${PORT}                              ║
║  URL:  ws://localhost:${PORT}               ║
╚════════════════════════════════════════════╝

프로토콜:
- byte[0] = 0: stateVector 요청/응답
- byte[0] = 1: update 전송/수신

프론트엔드에서 다음 URL로 연결하세요:
ws://localhost:${PORT}/[room-name]
`);
