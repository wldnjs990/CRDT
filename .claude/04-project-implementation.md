# 프로젝트 구현 내용

## 1. 프로젝트 개요

**React Flow + Yjs를 이용한 실시간 협업 플로우 에디터**

```
┌─────────────────────────────────────────────────────────┐
│                      클라이언트                          │
│              React + Yjs + React Flow                   │
└─────────────────────────────────────────────────────────┘
                         │
                    WebSocket
                         │
                         ▼
              ┌─────────────────┐
              │   Node.js 서버   │
              │  (y-websocket)   │
              │   CRDT 동기화    │
              └─────────────────┘
```

---

## 2. 프로젝트 구조

```
CRDT/
├── .claude/               ← 문서 (현재 파일들)
│   ├── 01-crdt-fundamentals.md
│   ├── 02-yjs-overview.md
│   ├── 03-yjs-api-reference.md
│   └── 04-project-implementation.md
│
├── frontend/              ← React 클라이언트
│   ├── src/
│   │   ├── hooks/
│   │   │   └── useYjsFlow.ts      ← Yjs + React Flow 연동 훅
│   │   ├── components/
│   │   │   └── CollaborativeFlow.tsx  ← 플로우 에디터 UI
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
└── backend/               ← Node.js 서버
    ├── server.js          ← Yjs WebSocket 서버
    └── package.json
```

---

## 3. 백엔드 구현

### server.js

```javascript
import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';

const PORT = process.env.PORT || 1234;

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  const roomName = req.url?.slice(1) || 'default';
  console.log(`[연결] 클라이언트: ${clientIp}, 룸: ${roomName}`);

  // Yjs WebSocket 연결 설정 - 이 한 줄이 모든 CRDT 로직 처리
  setupWSConnection(ws, req);

  ws.on('close', () => {
    console.log(`[종료] 클라이언트: ${clientIp}, 룸: ${roomName}`);
  });
});
```

### setupWSConnection이 처리하는 것

- 룸(room) 관리
- 클라이언트 간 동기화
- 재연결 처리
- 메시지 브로드캐스트
- CRDT 상태 병합

### 실행

```bash
cd backend
pnpm dev
```

---

## 4. 프론트엔드 구현

### useYjsFlow.ts (핵심 훅)

```typescript
import { useCallback, useEffect, useState } from 'react';
import { Node, Edge } from '@xyflow/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const WS_URL = 'ws://localhost:1234';

interface UseYjsFlowOptions {
  roomId: string;
}

export function useYjsFlow({ roomId }: UseYjsFlowOptions) {
  const [nodes, setNodesState] = useState<Node[]>([]);
  const [edges, setEdgesState] = useState<Edge[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Yjs 인스턴스
  const [yjsState] = useState(() => {
    const ydoc = new Y.Doc();
    const yNodes = ydoc.getMap<Node>('nodes');
    const yEdges = ydoc.getMap<Edge>('edges');
    return { ydoc, yNodes, yEdges };
  });

  const { ydoc, yNodes, yEdges } = yjsState;

  // WebSocket 연결
  useEffect(() => {
    const provider = new WebsocketProvider(WS_URL, roomId, ydoc);

    provider.on('status', (event) => {
      setIsConnected(event.status === 'connected');
    });

    // Yjs → React 상태 동기화
    const updateNodes = () => setNodesState(Array.from(yNodes.values()));
    const updateEdges = () => setEdgesState(Array.from(yEdges.values()));

    yNodes.observe(updateNodes);
    yEdges.observe(updateEdges);

    updateNodes();
    updateEdges();

    return () => {
      yNodes.unobserve(updateNodes);
      yEdges.unobserve(updateEdges);
      provider.destroy();
    };
  }, [roomId, ydoc, yNodes, yEdges]);

  // 노드 조작 함수들
  const setNodes = useCallback((newNodes: Node[]) => {
    ydoc.transact(() => {
      const newIds = new Set(newNodes.map(n => n.id));
      yNodes.forEach((_, id) => {
        if (!newIds.has(id)) yNodes.delete(id);
      });
      newNodes.forEach(node => yNodes.set(node.id, node));
    });
  }, [ydoc, yNodes]);

  const addNode = useCallback((node: Node) => {
    yNodes.set(node.id, node);
  }, [yNodes]);

  const updateNode = useCallback((id: string, updates: Partial<Node>) => {
    const existing = yNodes.get(id);
    if (existing) {
      yNodes.set(id, { ...existing, ...updates });
    }
  }, [yNodes]);

  const deleteNode = useCallback((id: string) => {
    yNodes.delete(id);
    // 연결된 엣지도 삭제
    yEdges.forEach((edge, edgeId) => {
      if (edge.source === id || edge.target === id) {
        yEdges.delete(edgeId);
      }
    });
  }, [yNodes, yEdges]);

  // ... setEdges, addEdge, deleteEdge 등

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    deleteEdge,
    isConnected,
  };
}
```

### CollaborativeFlow.tsx (UI 컴포넌트)

```typescript
import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useYjsFlow } from '../hooks/useYjsFlow';

export function CollaborativeFlow({ roomId }: { roomId: string }) {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    addNode,
    isConnected,
  } = useYjsFlow({ roomId });

  // 노드 변경 (드래그 등)
  const onNodesChange = useCallback((changes) => {
    const updatedNodes = applyNodeChanges(changes, nodes);
    setNodes(updatedNodes);
  }, [nodes, setNodes]);

  // 더블클릭으로 노드 추가
  const onDoubleClick = useCallback((event) => {
    const bounds = event.target.getBoundingClientRect();
    const position = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };

    addNode({
      id: `node-${Date.now()}`,
      position,
      data: { label: `Node ${nodes.length + 1}` },
    });
  }, [nodes.length, addNode]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {/* 연결 상태 표시 */}
      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1000,
        padding: '8px 16px',
        backgroundColor: isConnected ? '#10b981' : '#ef4444',
        color: 'white',
      }}>
        {isConnected ? '연결됨 ✓' : '연결 끊김'}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDoubleClick={onDoubleClick}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

### 실행

```bash
cd frontend
pnpm dev
```

---

## 5. 사용 방법

### 1. 서버 실행

```bash
cd backend && pnpm dev
```

### 2. 클라이언트 실행

```bash
cd frontend && pnpm dev
```

### 3. 테스트

1. 브라우저 2개 열기
2. 둘 다 `http://localhost:5173` 접속
3. 한쪽에서 더블클릭으로 노드 추가
4. 다른 쪽에서 실시간 반영 확인

### 4. 다른 룸 접속

```
http://localhost:5173?room=my-room
```

---

## 6. 서버 교체 시

### Node.js → y-sweet (Rust)

```bash
# y-sweet 서버 실행
docker run -p 8080:8080 jamsocket/y-sweet
```

```typescript
// useYjsFlow.ts에서 URL만 변경
const WS_URL = 'ws://localhost:8080';  // 이것만 변경
```

**클라이언트 코드 나머지는 변경 없음**

---

## 7. 추가 구현 가능한 기능

| 기능 | 난이도 | 필요한 것 |
|------|--------|----------|
| Undo/Redo | ⭐⭐ | `UndoManager` |
| 커서 공유 | ⭐⭐ | `Awareness` |
| 오프라인 지원 | ⭐⭐ | `y-indexeddb` |
| 권한 관리 | ⭐⭐⭐ | 서버 수정 |
| 버전 히스토리 | ⭐⭐⭐ | DB 저장 |

---

## 8. 패키지 의존성

### Frontend (package.json)

```json
{
  "dependencies": {
    "@xyflow/react": "^12.10.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "y-websocket": "^3.0.0",
    "yjs": "^13.6.29"
  }
}
```

### Backend (package.json)

```json
{
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "ws": "^8.19.0",
    "y-websocket": "^3.0.0",
    "yjs": "^13.6.29"
  }
}
```

---

## 9. 핵심 포인트 요약

1. **백엔드는 16줄**: `setupWSConnection`이 모든 CRDT 로직 처리
2. **프론트엔드가 핵심**: Yjs + React 상태 연동이 주요 작업
3. **서버 교체 용이**: URL만 바꾸면 y-sweet으로 전환 가능
4. **Yjs 프로토콜 통일**: 어떤 서버든 동일한 바이너리 프로토콜 사용
