# CRDT와 Yjs로 실시간 협업 앱 만들기

> 주니어 개발자를 위한 실전 가이드

---

## 목차

1. [CRDT란 무엇인가?](#crdt란-무엇인가)
2. [왜 CRDT를 사용하는가?](#왜-crdt를-사용하는가)
3. [Yjs 핵심 개념](#yjs-핵심-개념)
4. [프로젝트 구조](#프로젝트-구조)
5. [코드 깊이 파헤치기](#코드-깊이-파헤치기)
6. [동기화 프로토콜 이해하기](#동기화-프로토콜-이해하기)
7. [React와 통합하기](#react와-통합하기)
8. [트러블슈팅](#트러블슈팅)
9. [실무 적용 팁](#실무-적용-팁)

---

## CRDT란 무엇인가?

### 한 줄 정의

> **CRDT (Conflict-free Replicated Data Type)**
> 여러 사용자가 동시에 데이터를 수정해도 **자동으로 충돌이 해결**되는 데이터 구조

### 쉬운 비유

Google Docs를 생각해보세요. 여러 사람이 동시에 문서를 편집해도 내용이 꼬이지 않죠? 이게 바로 CRDT 덕분입니다.

### 기존 방식 vs CRDT

| 구분 | 기존 방식 (락 기반) | CRDT |
|------|-------------------|------|
| 동시 편집 | ❌ 한 명만 편집 가능 | ✅ 모두 동시 편집 |
| 충돌 해결 | 수동 (사용자가 선택) | 자동 (알고리즘) |
| 오프라인 | ❌ 지원 안됨 | ✅ 나중에 동기화 |
| 복잡도 | 낮음 | 높음 |

### CRDT의 핵심 원리

```
사용자 A: "Hello" → "Hello World"
사용자 B: "Hello" → "Hello!"

[동시에 일어난 변경]

CRDT 결과: "Hello World!" (둘 다 반영!)
```

CRDT는 각 변경에 **고유한 ID**와 **타임스탬프**를 부여해서 순서를 정합니다.

---

## 왜 CRDT를 사용하는가?

### 사용 사례

| 앱 | 기능 |
|----|------|
| Figma | 실시간 디자인 협업 |
| Notion | 실시간 문서 편집 |
| Linear | 실시간 이슈 트래킹 |
| VS Code Live Share | 실시간 코드 편집 |

### CRDT가 필요한 상황

- ✅ 여러 사용자가 동시에 같은 데이터를 수정
- ✅ 오프라인에서도 작업하고 나중에 동기화
- ✅ 실시간 협업 기능이 필요
- ✅ 서버 부하를 줄이고 싶음 (P2P 가능)

### CRDT가 불필요한 상황

- ❌ 단순 CRUD (Create, Read, Update, Delete)
- ❌ 동시 편집이 거의 없음
- ❌ 데이터 일관성보다 성능이 중요

---

## Yjs 핵심 개념

### Yjs란?

> JavaScript/TypeScript용 CRDT 라이브러리
> 텍스트, 배열, 맵 등 다양한 데이터 타입 지원

### 핵심 구성요소

```
┌─────────────────────────────────────────┐
│                 Y.Doc                    │
│  (CRDT 문서 - 모든 데이터의 컨테이너)      │
│                                          │
│  ┌──────────┐  ┌──────────┐             │
│  │  Y.Map   │  │  Y.Array │  ...        │
│  │ (노드들) │  │ (엣지들) │              │
│  └──────────┘  └──────────┘             │
└─────────────────────────────────────────┘
         │
         │ 변경 발생 시
         ▼
┌─────────────────────────────────────────┐
│            State Vector                  │
│  (각 클라이언트가 어디까지 알고 있는지)    │
│                                          │
│  { clientA: 5, clientB: 3, clientC: 7 }  │
└─────────────────────────────────────────┘
         │
         │ 네트워크 전송
         ▼
┌─────────────────────────────────────────┐
│              Update                      │
│  (실제 변경 내용 - 바이너리 형태)         │
│                                          │
│  Uint8Array [1, 2, 45, 128, ...]        │
└─────────────────────────────────────────┘
```

### 주요 데이터 타입

| 타입 | 용도 | 예시 |
|------|------|------|
| `Y.Doc` | 문서 컨테이너 | 전체 앱 상태 |
| `Y.Map` | 키-값 저장소 | 노드 목록, 설정 |
| `Y.Array` | 순서 있는 목록 | 채팅 메시지, 리스트 |
| `Y.Text` | 텍스트 편집 | 문서 내용 |

### 코드로 보는 기본 사용법

```typescript
import * as Y from 'yjs';

// 1. 문서 생성
const ydoc = new Y.Doc();

// 2. 공유 데이터 타입 가져오기
const yNodes = ydoc.getMap('nodes');  // Y.Map<Node>
const yEdges = ydoc.getMap('edges');  // Y.Map<Edge>

// 3. 데이터 추가
yNodes.set('node-1', {
  id: 'node-1',
  position: { x: 100, y: 200 }
});

// 4. 데이터 읽기
const node = yNodes.get('node-1');

// 5. 데이터 삭제
yNodes.delete('node-1');

// 6. 변경 감지
yNodes.observe((event) => {
  console.log('노드가 변경됨!', event);
});
```

---

## 프로젝트 구조

### 디렉토리 구조

```
CRDT/
├── frontend/                    # React 프론트엔드
│   ├── src/
│   │   ├── hooks/
│   │   │   └── useYjsSync.ts   # ⭐ CRDT 동기화 훅
│   │   ├── components/
│   │   │   ├── CollaborativeFlowV2.tsx  # 메인 컴포넌트
│   │   │   └── NodeSidebar.tsx          # 노드 편집 UI
│   │   └── App.tsx
│   └── package.json
│
└── backend/                     # WebSocket 서버
    ├── server-pure.js          # ⭐ y-websocket 없는 순수 구현
    └── package.json
```

### 데이터 흐름

```
┌─────────────┐     WebSocket      ┌─────────────┐
│  Browser A  │◄──────────────────►│   Server    │
│   (Y.Doc)   │                    │   (Y.Doc)   │
└─────────────┘                    └─────────────┘
                                         ▲
                                         │
                                         ▼
                                   ┌─────────────┐
                                   │  Browser B  │
                                   │   (Y.Doc)   │
                                   └─────────────┘
```

---

## 코드 깊이 파헤치기

### useYjsSync.ts - CRDT 동기화의 심장

이 파일이 가장 중요합니다. 한 줄씩 이해해봅시다.

#### 1단계: 상태 선언

```typescript
// React 상태 - UI에 표시될 데이터
const [nodes, setNodesState] = useState<Node[]>([]);
const [edges, setEdgesState] = useState<Edge[]>([]);
const [connectionStatus, setConnectionStatus] = useState<
  'connecting' | 'connected' | 'disconnected'
>('connecting');

// Refs - 컴포넌트 리렌더링과 무관하게 유지
const wsRef = useRef<WebSocket | null>(null);
const ydocRef = useRef<Y.Doc | null>(null);
const yNodesRef = useRef<Y.Map<Node> | null>(null);
```

> 💡 **왜 Ref를 사용할까?**
> Y.Doc, WebSocket은 한 번 생성하면 계속 유지해야 합니다.
> useState로 관리하면 리렌더링마다 새로 생성될 수 있어요.

#### 2단계: Y.Doc 초기화

```typescript
// 컴포넌트 최초 렌더링 시 한 번만 실행
if (!ydocRef.current) {
  ydocRef.current = new Y.Doc();
  yNodesRef.current = ydocRef.current.getMap<Node>('nodes');
  yEdgesRef.current = ydocRef.current.getMap<Edge>('edges');
}
```

> 💡 **getMap('nodes')의 의미**
> 같은 이름으로 가져오면 항상 같은 Map을 반환합니다.
> 모든 클라이언트가 'nodes'라는 이름으로 접근하면 자동 동기화!

#### 3단계: WebSocket 연결

```typescript
const connect = () => {
  const ws = new WebSocket(`ws://localhost:1234/${roomId}`);
  ws.binaryType = 'arraybuffer';  // 바이너리 데이터 수신 설정

  ws.onopen = () => {
    // 연결 성공! 내 상태 벡터 전송
    const stateVector = Y.encodeStateVector(ydoc);
    const message = new Uint8Array(stateVector.length + 1);
    message[0] = 0;  // 메시지 타입: stateVector
    message.set(stateVector, 1);
    ws.send(message);
  };
};
```

> 💡 **State Vector란?**
> "나는 여기까지 알고 있어"를 나타내는 정보입니다.
> 서버는 이걸 보고 "그럼 이후 변경만 보내줄게"라고 응답합니다.

#### 4단계: 메시지 수신 처리

```typescript
ws.onmessage = (event) => {
  const data = new Uint8Array(event.data);
  const messageType = data[0];      // 첫 바이트: 메시지 타입
  const payload = data.slice(1);    // 나머지: 실제 데이터

  if (messageType === 0) {
    // 상대방이 state vector를 보냄 → 내 변경분 전송
    const update = Y.encodeStateAsUpdate(ydoc, payload);
    // ... 전송
  } else if (messageType === 1) {
    // 업데이트 수신 → 내 문서에 적용
    Y.applyUpdate(ydoc, payload, 'remote');
  }
};
```

#### 5단계: 로컬 변경 전송

```typescript
// Y.Doc에서 변경이 발생하면 호출됨
const handleUpdate = (update: Uint8Array, origin: unknown) => {
  // 'remote'에서 온 변경은 다시 전송하지 않음 (무한루프 방지!)
  if (origin === 'remote') return;

  // 서버로 전송
  const message = new Uint8Array(update.length + 1);
  message[0] = 1;  // 메시지 타입: update
  message.set(update, 1);
  ws.send(message);
};

ydoc.on('update', handleUpdate);
```

> 💡 **origin의 역할**
> 변경의 출처를 구분합니다.
> - `'remote'`: 서버에서 받은 변경
> - `undefined` 또는 다른 값: 로컬에서 발생한 변경

#### 6단계: Yjs → React 상태 동기화

```typescript
useEffect(() => {
  const updateNodes = () => {
    const nodeArray = Array.from(yNodes.values());
    setNodesState(nodeArray);  // React 상태 업데이트
  };

  yNodes.observe(updateNodes);  // Y.Map 변경 감지
  updateNodes();  // 초기 데이터 로드

  return () => yNodes.unobserve(updateNodes);
}, [yNodes]);
```

> 💡 **observe 패턴**
> Y.Map이 변경될 때마다 콜백이 호출됩니다.
> 여기서 React 상태를 업데이트하면 UI가 자동으로 갱신!

---

## 동기화 프로토콜 이해하기

### 메시지 포맷

```
┌─────────────────────────────────────┐
│  byte[0]  │     byte[1...]          │
│  타입     │     페이로드 (Yjs 데이터) │
└─────────────────────────────────────┘

타입 0: State Vector (상태 벡터)
타입 1: Update (변경 내용)
```

### 동기화 시나리오

#### 시나리오 1: 새 클라이언트 접속

```
Client A (기존)                    Server                    Client B (신규)
    │                                │                            │
    │                                │◄─── 연결 ──────────────────│
    │                                │                            │
    │                                │◄─── StateVector ───────────│
    │                                │     "나 아무것도 몰라"        │
    │                                │                            │
    │                                │─── Update ────────────────►│
    │                                │     "여태까지 변경 다 보내줄게" │
    │                                │                            │
```

#### 시나리오 2: 동시 편집

```
Client A                           Server                    Client B
    │                                │                            │
    │─── Update (노드 이동) ────────►│                            │
    │                                │─── Update (브로드캐스트) ──►│
    │                                │                            │
    │                                │◄─── Update (노드 추가) ─────│
    │◄── Update (브로드캐스트) ───────│                            │
    │                                │                            │
```

### 서버 코드 (server-pure.js)

```javascript
// 룸별로 Y.Doc 관리
const rooms = new Map();  // roomId → { doc: Y.Doc, clients: Set<WebSocket> }

wss.on('connection', (ws, req) => {
  const roomId = req.url.slice(1);  // URL에서 룸 ID 추출

  // 룸이 없으면 생성
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      doc: new Y.Doc(),
      clients: new Set()
    });
  }

  const room = rooms.get(roomId);
  room.clients.add(ws);

  ws.on('message', (data) => {
    const message = new Uint8Array(data);
    const type = message[0];
    const payload = message.slice(1);

    if (type === 0) {
      // State Vector 수신 → 변경분 전송
      const update = Y.encodeStateAsUpdate(room.doc, payload);
      ws.send(createMessage(1, update));
    } else if (type === 1) {
      // Update 수신 → 문서에 적용 & 브로드캐스트
      Y.applyUpdate(room.doc, payload);

      // 다른 클라이언트들에게 전달
      room.clients.forEach(client => {
        if (client !== ws) {
          client.send(message);
        }
      });
    }
  });
});
```

---

## React와 통합하기

### 컴포넌트 구조

```
┌─────────────────────────────────────────────┐
│            CollaborativeFlowV2              │
│  ┌───────────────────────────────────────┐  │
│  │           ReactFlow                   │  │
│  │  - nodes (from useYjsSync)           │  │
│  │  - edges (from useYjsSync)           │  │
│  │  - onNodesChange → setNodes          │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │           NodeSidebar                 │  │
│  │  - selectedNode                       │  │
│  │  - onUpdate → updateNode             │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 노드 변경 처리

```typescript
// 드래그, 선택 등 모든 노드 변경
const onNodesChange = useCallback(
  (changes: NodeChange<Node>[]) => {
    // React Flow의 유틸리티로 변경 적용
    const updatedNodes = applyNodeChanges(changes, nodes);

    // Yjs에 반영 (→ 자동으로 다른 클라이언트에 전파)
    setNodes(updatedNodes);
  },
  [nodes, setNodes]
);
```

### 노드 추가

```typescript
const handleAddNode = useCallback(() => {
  const newNode: Node = {
    id: `node-${Date.now()}`,  // 고유 ID (타임스탬프 사용)
    position: {
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
    },
    data: {
      label: `Node ${nodes.length + 1}`,
      description: '',
      color: '#ffffff',
    },
  };

  addNode(newNode);  // useYjsSync의 함수
}, [nodes.length, addNode]);
```

### 노드 업데이트 (사이드바)

```typescript
// NodeSidebar에서 호출
const handleNodeUpdate = useCallback(
  (id: string, updates: Partial<Node>) => {
    updateNode(id, updates);  // Yjs 업데이트

    // 로컬 선택 상태도 업데이트
    if (selectedNode?.id === id) {
      setSelectedNode(prev => prev ? { ...prev, ...updates } : null);
    }
  },
  [updateNode, selectedNode]
);
```

---

## 트러블슈팅

### 문제 1: TypeScript 타입 에러

```
'Connection' cannot be used as a value because it was imported using 'import type'
```

**원인**: React Flow의 타입들은 타입 전용 import가 필요

**해결**:
```typescript
// ❌ 잘못된 방법
import { Node, Edge, Connection } from '@xyflow/react';

// ✅ 올바른 방법
import type { Node, Edge, Connection } from '@xyflow/react';
```

### 문제 2: React 19 경고 - useEffect에서 setState

```
Warning: A component is modifying state during render
```

**원인**: useEffect에서 다른 컴포넌트의 상태를 직접 수정

**해결**: key prop을 사용한 상태 초기화

```typescript
// ❌ 문제가 되는 코드
function NodeSidebar({ node }) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    setLabel(node?.data?.label || '');  // 경고 발생!
  }, [node]);
}

// ✅ 해결: key로 컴포넌트 리마운트
function NodeSidebar({ node, ...props }) {
  if (!node) return null;
  return <NodeSidebarContent key={node.id} node={node} {...props} />;
}

function NodeSidebarContent({ node }) {
  // key가 바뀌면 컴포넌트가 새로 마운트되어 초기값 적용
  const [label, setLabel] = useState(node.data?.label || '');
}
```

### 문제 3: WebSocket 연결 루프 (React Strict Mode)

```
[연결] 클라이언트 A
[종료] 클라이언트 A
[연결] 클라이언트 A
[종료] 클라이언트 A
... (무한 반복)
```

**원인**: React Strict Mode가 useEffect를 두 번 실행

**해결**: cleanup 상태 추적

```typescript
const isCleanedUpRef = useRef(false);

useEffect(() => {
  isCleanedUpRef.current = false;  // 마운트 시 리셋

  const connect = () => {
    // cleanup 됐으면 연결하지 않음
    if (isCleanedUpRef.current) return;
    // ... 연결 로직
  };

  // cleanup 함수
  return () => {
    isCleanedUpRef.current = true;  // cleanup 표시
    ws.close();
  };
}, [roomId]);
```

---

## 실무 적용 팁

### 1. y-websocket vs 순수 WebSocket

| 구분 | y-websocket | 순수 WebSocket |
|------|-------------|----------------|
| 설정 난이도 | 쉬움 | 어려움 |
| 커스터마이징 | 제한적 | 자유로움 |
| Spring 연동 | 어려움 | 쉬움 |
| 학습 가치 | 낮음 | 높음 |

**추천**: 학습 목적이라면 순수 WebSocket, 빠른 프로토타이핑이라면 y-websocket

### 2. 노드 ID 생성 전략

```typescript
// ❌ 단순 타임스탬프 (동시 생성 시 충돌 가능)
const id = `node-${Date.now()}`;

// ✅ UUID 사용 (권장)
import { v4 as uuidv4 } from 'uuid';
const id = `node-${uuidv4()}`;

// ✅ 또는 클라이언트 ID + 타임스탬프
const id = `node-${clientId}-${Date.now()}`;
```

### 3. 대용량 데이터 처리

```typescript
// 많은 노드를 한 번에 추가할 때
ydoc.transact(() => {
  // transact 안의 모든 변경이 하나의 update로 묶임
  newNodes.forEach(node => yNodes.set(node.id, node));
});
```

### 4. 디버깅 팁

```typescript
// Y.Doc 내용 확인
console.log('nodes:', Array.from(yNodes.entries()));

// 모든 업데이트 로깅
ydoc.on('update', (update, origin) => {
  console.log('Update:', {
    size: update.length,
    origin,
    timestamp: new Date().toISOString()
  });
});
```

### 5. 에러 처리

```typescript
ws.onerror = (error) => {
  console.error('WebSocket 에러:', error);
  // 사용자에게 알림
  setConnectionStatus('disconnected');
};

ws.onclose = () => {
  // 자동 재연결
  if (!isCleanedUpRef.current) {
    setTimeout(connect, 2000);  // 2초 후 재시도
  }
};
```

---

## 핵심 요약

### 기억해야 할 것

1. **Y.Doc** = 모든 데이터의 컨테이너
2. **State Vector** = "나는 여기까지 알아"
3. **Update** = 실제 변경 내용 (바이너리)
4. **observe()** = 변경 감지 → React 상태 업데이트
5. **origin** = 변경 출처 구분 (무한루프 방지)

### 동기화 흐름

```
로컬 변경 → Y.Doc → 'update' 이벤트 → WebSocket 전송
                                           │
                                           ▼
WebSocket 수신 ← 브로드캐스트 ← 서버 ← 다른 클라이언트
      │
      ▼
Y.applyUpdate → Y.Doc 업데이트 → observe 콜백 → React 상태 → UI
```

---

## 다음 단계

1. **Awareness 추가**: 다른 사용자의 커서/선택 표시
2. **Undo/Redo**: Y.UndoManager 사용
3. **오프라인 지원**: IndexedDB 연동
4. **인증 추가**: WebSocket 연결 시 토큰 검증
5. **Spring 백엔드**: Java로 서버 재구현

---

> 📚 **참고 자료**
> - [Yjs 공식 문서](https://docs.yjs.dev/)
> - [React Flow 문서](https://reactflow.dev/)
> - [CRDT 논문](https://hal.inria.fr/inria-00555588/document)
