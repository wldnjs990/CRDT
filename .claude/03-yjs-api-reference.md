# Yjs API 레퍼런스

## 1. Y.Doc (문서)

모든 공유 데이터의 컨테이너.

```typescript
import * as Y from 'yjs';

// 문서 생성
const ydoc = new Y.Doc();

// 공유 타입 가져오기
const ymap = ydoc.getMap('my-map');
const yarray = ydoc.getArray('my-array');
const ytext = ydoc.getText('my-text');
```

### 주요 메서드

| 메서드 | 설명 |
|--------|------|
| `getMap(name)` | Y.Map 인스턴스 반환 |
| `getArray(name)` | Y.Array 인스턴스 반환 |
| `getText(name)` | Y.Text 인스턴스 반환 |
| `transact(fn)` | 트랜잭션 실행 |
| `destroy()` | 문서 정리 |

---

## 2. Y.Map

키-값 저장소. JavaScript의 `Map`과 유사.

**내부 CRDT**: LWW-Map (Last-Writer-Wins)

```typescript
const ymap = ydoc.getMap('nodes');

// 값 설정
ymap.set('node-1', { x: 100, y: 200 });

// 값 가져오기
const node = ymap.get('node-1');

// 값 삭제
ymap.delete('node-1');

// 크기
ymap.size;

// 순회
ymap.forEach((value, key) => { ... });

// 전체 값 배열
Array.from(ymap.values());
```

### 변경 감지

```typescript
ymap.observe((event) => {
  event.changes.keys.forEach((change, key) => {
    if (change.action === 'add') {
      console.log(`추가: ${key}`);
    } else if (change.action === 'update') {
      console.log(`수정: ${key}`);
    } else if (change.action === 'delete') {
      console.log(`삭제: ${key}`);
    }
  });
});
```

### 주의사항

```typescript
// ❌ 잘못된 사용: 객체 직접 수정
const node = ymap.get('node-1');
node.x = 100;  // 동기화 안됨!

// ✅ 올바른 사용: set으로 교체
const node = ymap.get('node-1');
ymap.set('node-1', { ...node, x: 100 });
```

---

## 3. Y.Array

순서가 있는 리스트. JavaScript의 `Array`와 유사.

**내부 CRDT**: YATA (Yet Another Transformation Approach)

```typescript
const yarray = ydoc.getArray('items');

// 끝에 추가
yarray.push(['item1', 'item2']);

// 앞에 추가
yarray.unshift(['item0']);

// 특정 위치에 삽입
yarray.insert(1, ['inserted']);

// 삭제
yarray.delete(0, 1);  // index 0부터 1개 삭제

// 인덱스로 접근
yarray.get(0);

// 길이
yarray.length;

// 배열로 변환
yarray.toArray();
```

### 변경 감지

```typescript
yarray.observe((event) => {
  event.changes.delta.forEach((change) => {
    if (change.insert) {
      console.log('삽입:', change.insert);
    }
    if (change.delete) {
      console.log('삭제 개수:', change.delete);
    }
    if (change.retain) {
      console.log('유지 개수:', change.retain);
    }
  });
});
```

---

## 4. Y.Text

텍스트 편집용. 문자 단위 CRDT.

```typescript
const ytext = ydoc.getText('content');

// 삽입
ytext.insert(0, 'Hello');
ytext.insert(5, ' World');

// 삭제
ytext.delete(0, 5);  // 'Hello' 삭제

// 전체 텍스트
ytext.toString();

// 길이
ytext.length;
```

### 서식 (Formatting)

```typescript
// 서식 적용
ytext.format(0, 5, { bold: true });

// 서식과 함께 삽입
ytext.insert(0, 'Bold', { bold: true });
```

---

## 5. UndoManager

실행 취소/다시 실행 관리.

```typescript
import { UndoManager } from 'yjs';

const ymap = ydoc.getMap('nodes');
const yarray = ydoc.getArray('edges');

// UndoManager 생성 (추적할 타입 지정)
const undoManager = new UndoManager([ymap, yarray]);

// Undo
undoManager.undo();

// Redo
undoManager.redo();

// 가능 여부 확인
undoManager.canUndo();
undoManager.canRedo();

// 스택 초기화
undoManager.clear();
```

### 키보드 단축키 연결

```typescript
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        undoManager.redo();
      } else {
        undoManager.undo();
      }
    }
  }
});
```

### 트랜잭션과 함께 사용

```typescript
// 여러 변경을 하나의 Undo 단위로
ydoc.transact(() => {
  ymap.set('node-1', { ... });
  ymap.set('node-2', { ... });
}, 'my-origin');

// 이제 undo() 한 번에 두 변경 모두 취소됨
```

---

## 6. transact (트랜잭션)

여러 변경을 하나의 단위로 묶기.

```typescript
// 나쁜 예: 개별 변경
ymap.set('node-1', node1);  // 이벤트 발생
ymap.set('node-2', node2);  // 이벤트 발생
yarray.push([edge1]);       // 이벤트 발생

// 좋은 예: 트랜잭션
ydoc.transact(() => {
  ymap.set('node-1', node1);
  ymap.set('node-2', node2);
  yarray.push([edge1]);
});  // 이벤트 한 번만 발생
```

### 장점

- 네트워크 효율 (한 번에 전송)
- Undo/Redo가 한 단위로 동작
- 중간 상태 없음

---

## 7. observe / observeDeep

### observe

직접 자식의 변경만 감지.

```typescript
ymap.observe((event, transaction) => {
  // ymap의 직접적인 변경만 감지
  // ymap.set('key', value) → 감지됨
  // ymap.get('key').nested = 1 → 감지 안됨 (중첩)
});
```

### observeDeep

모든 중첩 변경 감지.

```typescript
ymap.observeDeep((events, transaction) => {
  // 모든 깊이의 변경 감지
  events.forEach(event => {
    console.log(event.path);  // 변경 경로
  });
});
```

### 주의: observe 안에서 수정 금지

```typescript
// ❌ 무한 루프 위험
ymap.observe(() => {
  ymap.set('key', value);
});

// ✅ 조건부 처리
ymap.observe((event, transaction) => {
  if (transaction.local) return;  // 내 변경은 무시
  // 원격 변경에만 반응
});
```

---

## 8. 상태 인코딩/디코딩

### 전체 상태 저장

```typescript
// 상태를 바이너리로 인코딩
const state = Y.encodeStateAsUpdate(ydoc);  // Uint8Array

// 바이너리를 문서에 적용
Y.applyUpdate(ydoc, state);
```

### 변경분만 저장

```typescript
// 변경 이벤트 수신
ydoc.on('update', (update: Uint8Array) => {
  // update를 서버/다른 클라이언트에 전송
  sendToServer(update);
});

// 받은 변경 적용
function receiveUpdate(update: Uint8Array) {
  Y.applyUpdate(ydoc, update);
}
```

---

## 9. WebsocketProvider

WebSocket 기반 동기화.

```typescript
import { WebsocketProvider } from 'y-websocket';

const provider = new WebsocketProvider(
  'ws://localhost:1234',  // 서버 URL
  'room-name',            // 룸 이름
  ydoc                    // Y.Doc 인스턴스
);

// 연결 상태 확인
provider.on('status', (event) => {
  console.log(event.status);  // 'connecting' | 'connected' | 'disconnected'
});

// 동기화 완료 확인
provider.on('sync', (isSynced) => {
  console.log('동기화됨:', isSynced);
});

// 연결 해제
provider.destroy();
```

---

## 10. Awareness

커서, 선택 상태 등 **임시 상태** 공유.

```typescript
const awareness = provider.awareness;

// 내 상태 설정
awareness.setLocalState({
  user: {
    name: '사용자1',
    color: '#ff0000'
  },
  cursor: { x: 100, y: 200 }
});

// 다른 사용자 상태 구독
awareness.on('change', () => {
  const states = awareness.getStates();  // Map<clientId, state>

  states.forEach((state, clientId) => {
    if (clientId !== ydoc.clientID) {
      console.log('다른 사용자:', state.user.name);
    }
  });
});

// 내 상태 제거
awareness.setLocalState(null);
```

### Document vs Awareness

| 구분 | Y.Doc | Awareness |
|------|-------|-----------|
| 용도 | 영구 데이터 | 임시 상태 |
| 예시 | 노드, 엣지 | 커서, 선택 |
| 저장 | ✅ 저장됨 | ❌ 휘발성 |
| CRDT | YATA/LWW | 단순 브로드캐스트 |

---

## 11. IndexeddbPersistence

브라우저 오프라인 저장.

```typescript
import { IndexeddbPersistence } from 'y-indexeddb';

const persistence = new IndexeddbPersistence('my-doc-name', ydoc);

// 로드 완료 확인
persistence.on('synced', () => {
  console.log('로컬 데이터 로드 완료');
});

// 정리
persistence.destroy();
```

---

## 12. 실수하기 쉬운 패턴

### 객체 직접 수정

```typescript
// ❌
const node = ymap.get('node-1');
node.position.x = 100;

// ✅
const node = ymap.get('node-1');
ymap.set('node-1', {
  ...node,
  position: { ...node.position, x: 100 }
});
```

### observe 안에서 수정

```typescript
// ❌
ymap.observe(() => {
  ymap.set('lastUpdated', Date.now());
});

// ✅
ymap.observe((event, transaction) => {
  if (!transaction.local) {
    // UI만 업데이트
  }
});
```

### Provider 정리 안 함

```typescript
// ❌ 메모리 누수
useEffect(() => {
  const provider = new WebsocketProvider(...);
}, []);

// ✅
useEffect(() => {
  const provider = new WebsocketProvider(...);
  return () => provider.destroy();
}, []);
```

---

## 다음 단계

- [04-project-implementation.md](./04-project-implementation.md) - 프로젝트 구현 내용
