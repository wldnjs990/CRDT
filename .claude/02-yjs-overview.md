# Yjs 라이브러리 개요

## 1. Yjs란?

JavaScript/TypeScript용 **Operation-based CRDT** 라이브러리.

실시간 협업 애플리케이션을 만들기 위한 de facto 표준.

```
Google Docs 같은 기능을 직접 구현하지 않아도 됨
Yjs가 CRDT 로직을 전부 처리해줌
```

---

## 2. Yjs 생태계

```
┌─────────────────────────────────────────────────────────┐
│                       Yjs Core                          │
│              (Y.Doc, Y.Map, Y.Array, Y.Text)           │
└─────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │ Provider │     │ Provider │     │ Provider │
   │(y-websocket)│  │(y-webrtc)│    │(y-indexeddb)│
   └──────────┘     └──────────┘     └──────────┘
     네트워크          P2P            로컬 저장
```

### Provider 종류

| Provider | 설명 | 용도 |
|----------|------|------|
| **y-websocket** | WebSocket 서버 통신 | 가장 일반적 |
| **y-webrtc** | P2P 직접 연결 | 서버 없이 동기화 |
| **y-indexeddb** | 브라우저 로컬 저장 | 오프라인 지원 |

---

## 3. Yjs vs 다른 솔루션

| 항목 | Yjs | Automerge | Liveblocks |
|------|-----|-----------|------------|
| 타입 | 라이브러리 | 라이브러리 | SaaS |
| 가격 | 무료 | 무료 | 유료 |
| 언어 | JS/TS | JS/TS/Rust | JS/TS |
| 서버 | 직접 운영 | 직접 운영 | 클라우드 |
| 생태계 | ✅ 가장 큼 | 보통 | 제한적 |

---

## 4. Yjs + 다른 언어 (Yrs)

Yjs의 Rust 포팅 버전 = **Yrs**

```
Yjs (JavaScript) ←→ 100% 호환 ←→ Yrs (Rust)
```

### Yrs 바인딩

| 언어 | 패키지 | 상태 |
|------|--------|------|
| JavaScript | `yjs` (원본) | ✅ 안정 |
| Rust | `yrs` | ✅ 안정 |
| Python | `y-py` | ✅ 안정 |
| Ruby | `y-rb` | ✅ 안정 |
| Java/Kotlin | JNI 바인딩 | ⚠️ 실험적 |

---

## 5. y-sweet (Rust 서버)

Node.js 없이 Yjs 서버를 운영하고 싶다면:

```bash
# Docker로 바로 실행
docker run -p 8080:8080 jamsocket/y-sweet
```

```
┌──────────┐     ┌───────────┐     ┌──────────┐
│  React   │ WS  │  y-sweet  │ HTTP│  Spring  │
│  (Yjs)   │←───→│  (Rust)   │←───→│  (API)   │
└──────────┘     └───────────┘     └──────────┘
                  CRDT 동기화        비즈니스 로직
```

**장점:**
- Node.js 안 배워도 됨
- Yjs 클라이언트와 완벽 호환
- 성능 우수 (Rust)

---

## 6. 서버 교체 시 클라이언트 변경

**변경 없음!**

```typescript
// Node.js 서버 사용 시
const provider = new WebsocketProvider('ws://localhost:1234', room, ydoc);

// y-sweet 서버로 교체 시
const provider = new WebsocketProvider('ws://localhost:8080', room, ydoc);
//                                      ↑ 주소만 변경
```

Yjs, Yrs, y-sweet 모두 **같은 바이너리 프로토콜** 사용.

---

## 7. Yjs가 기본 제공하는 것

| 기능 | 클래스/메서드 | 설명 |
|------|--------------|------|
| 공유 데이터 타입 | `Y.Map`, `Y.Array`, `Y.Text` | CRDT 자료구조 |
| 실시간 동기화 | `WebsocketProvider` | 클라이언트 간 동기화 |
| Undo/Redo | `UndoManager` | 실행 취소 |
| 변경 감지 | `.observe()` | 데이터 변경 이벤트 |
| 트랜잭션 | `ydoc.transact()` | 여러 변경을 하나로 |
| 상태 인코딩 | `Y.encodeStateAsUpdate()` | 바이너리 직렬화 |
| 오프라인 저장 | `y-indexeddb` | 브라우저 로컬 저장 |
| 사용자 상태 | `Awareness` | 커서, 선택 상태 공유 |

---

## 8. 사용자가 커스텀해야 하는 것

| 기능 | 이유 | 구현 방법 |
|------|------|----------|
| UI 연동 | 프레임워크마다 다름 | React/Vue 상태와 Yjs 연결 |
| 커서 렌더링 | UI 라이브러리 의존 | Awareness + CSS |
| 권한 관리 | 비즈니스 로직 | 서버에서 검증 |
| 데이터 저장 | DB 선택 다양 | 서버에서 snapshot 저장 |
| 충돌 UI | UX 선택 사항 | 토스트, 하이라이트 등 |

---

## 9. 프론트엔드 vs 백엔드 역할

### CRDT에서는 프론트엔드가 핵심

```
전통적 방식:
클라이언트 → 서버(처리) → 클라이언트
             "서버가 진실"

CRDT 방식:
클라이언트(처리) ↔ 클라이언트(처리)
      ↘          ↗
       서버(중계만)
    "각 클라이언트가 진실"
```

### 역할 분담

| 영역 | 백엔드 | 프론트엔드 |
|------|--------|-----------|
| CRDT 로직 | 중계만 | ✅ 직접 처리 |
| 충돌 해결 | X | ✅ Yjs가 처리 |
| 상태 관리 | 저장소 역할 | ✅ 실시간 반영 |
| UI 동기화 | X | ✅ React 연동 |

---

## 다음 단계

- [03-yjs-api-reference.md](./03-yjs-api-reference.md) - Yjs API 상세 레퍼런스
- [04-project-implementation.md](./04-project-implementation.md) - 프로젝트 구현 내용
