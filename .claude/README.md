# CRDT 학습 및 프로젝트 문서

이 폴더는 CRDT(Conflict-free Replicated Data Type) 학습 내용과 프로젝트 구현 컨텍스트를 담고 있습니다.

---

## 문서 구조

| 파일 | 내용 |
|------|------|
| [01-crdt-fundamentals.md](./01-crdt-fundamentals.md) | CRDT 기초 이론 |
| [02-yjs-overview.md](./02-yjs-overview.md) | Yjs 라이브러리 개요 |
| [03-yjs-api-reference.md](./03-yjs-api-reference.md) | Yjs API 상세 레퍼런스 |
| [04-project-implementation.md](./04-project-implementation.md) | 프로젝트 구현 내용 |

---

## 학습 순서

```
1. CRDT 기초 이론 (01)
   ├── CRDT 개념
   ├── CAP 정리
   ├── Eventual Consistency
   ├── State-based vs Operation-based
   └── 수학적 속성 (교환법칙, 결합법칙, 멱등성)

2. Yjs 개요 (02)
   ├── Yjs 생태계
   ├── Provider 종류
   ├── Yrs (다른 언어 지원)
   └── 프론트엔드 vs 백엔드 역할

3. Yjs API (03)
   ├── Y.Doc, Y.Map, Y.Array, Y.Text
   ├── UndoManager
   ├── transact
   ├── observe
   ├── WebsocketProvider
   └── Awareness

4. 프로젝트 구현 (04)
   ├── 프로젝트 구조
   ├── 백엔드 코드
   ├── 프론트엔드 코드
   └── 실행 방법
```

---

## 프로젝트 현재 상태

### 구현 완료

- [x] Node.js Yjs WebSocket 서버
- [x] React + Yjs 클라이언트
- [x] React Flow 연동
- [x] 실시간 노드/엣지 동기화
- [x] 연결 상태 표시

### 추가 구현 가능

- [ ] Undo/Redo (`UndoManager`)
- [ ] 커서 공유 (`Awareness`)
- [ ] 오프라인 지원 (`y-indexeddb`)
- [ ] 권한 관리 (서버 수정)
- [ ] 버전 히스토리 (DB 저장)

---

## 빠른 시작

```bash
# 1. 백엔드 서버 실행
cd backend && pnpm dev

# 2. 프론트엔드 실행
cd frontend && pnpm dev

# 3. 브라우저 2개로 http://localhost:5173 접속
```

---

## 핵심 개념 요약

### CRDT 핵심 원리

```
"같은 연산들을 어떤 순서로 적용해도 결과가 같다"
```

### Yjs 데이터 타입

| Yjs 타입 | 내부 CRDT | 용도 |
|----------|----------|------|
| `Y.Map` | LWW-Map | 객체, 키-값 |
| `Y.Array` | YATA | 리스트 |
| `Y.Text` | YATA | 텍스트 |

### 백엔드 vs 프론트엔드

```
백엔드 16줄 = 동기화 인프라 (중계만)
프론트엔드  = 실제 CRDT 로직 + UI
```

### 서버 교체

```typescript
// URL만 바꾸면 됨
const WS_URL = 'ws://localhost:1234';  // Node.js
const WS_URL = 'ws://localhost:8080';  // y-sweet (Rust)
```

---

## Claude Code 연동

이 문서들은 다른 VSCode 환경에서 Claude Code가 프로젝트 컨텍스트를 즉시 파악할 수 있도록 작성되었습니다.

새 세션에서:
```
"이 프로젝트 컨텍스트를 파악해줘"
또는
".claude 폴더의 문서들을 읽고 이해해줘"
```
