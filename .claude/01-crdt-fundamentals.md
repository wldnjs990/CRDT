# CRDT 기초 이론

## 1. CRDT란?

**Conflict-free Replicated Data Type** (충돌 없는 복제 데이터 타입)

분산 시스템에서 여러 노드가 동시에 데이터를 수정해도 **충돌 없이 자동으로 병합**되는 데이터 구조.

```
전통적 방식: 충돌 발생 → 감지 → 해결 (복잡)
CRDT 방식:   충돌이 수학적으로 불가능하게 설계
```

---

## 2. 왜 CRDT가 필요한가?

### 분산 시스템의 문제

```
[ 사용자 A - 서울 ]          [ 사용자 B - 뉴욕 ]
       |                            |
       v                            v
   [ 서버 1 ] <-- 네트워크 --> [ 서버 2 ]
```

- A와 B가 동시에 같은 문서를 편집하면?
- 중앙 서버 하나만 쓰면? → 서버 죽으면 끝, 지연시간 큼
- 여러 서버 복제하면? → **데이터 충돌 문제 발생**

### CAP 정리

분산 시스템에서 **3가지를 동시에 만족할 수 없다**:

| 속성 | 의미 |
|------|------|
| **C**onsistency | 모든 노드가 같은 데이터를 본다 |
| **A**vailability | 항상 응답을 받을 수 있다 |
| **P**artition tolerance | 네트워크 단절에도 동작한다 |

**CRDT의 선택**: A + P (가용성 + 분할 내성)
- 일시적으로 데이터가 달라도 OK
- 나중에 **결국 일치**하면 됨 → **Eventual Consistency**

---

## 3. Eventual Consistency (결과적 일관성)

```
시간 →
노드A: [1] → [1,2] → [1,2,3] → [1,2,3,4]
                ↘︎          ↘︎
노드B: [1] → [1,3] → [1,2,3] → [1,2,3,4]
                          ↑
                    여기서 일치!
```

**핵심**: 업데이트가 멈추고 충분한 시간이 지나면, 모든 복제본이 **같은 상태**가 된다.

---

## 4. CRDT의 두 가지 종류

### State-based CRDT (CvRDT)

- 전체 상태를 전송
- 병합 함수로 상태 결합
- 대역폭 사용량 큼

```
A의 상태: { counter: 5 }
B의 상태: { counter: 3 }
병합 결과: { counter: max(5,3) = 5 }
```

### Operation-based CRDT (CmRDT)

- 연산(operation)만 전송
- 교환법칙 필요
- 대역폭 효율적
- **Yjs가 이 방식 사용**

```
A: increment()  → 다른 노드에 전파
B: increment()  → 다른 노드에 전파
결과: 순서 상관없이 둘 다 적용됨
```

---

## 5. CRDT가 요구하는 수학적 속성

### 교환법칙 (Commutativity)

```
A + B = B + A

insert("a") 후 insert("b") = insert("b") 후 insert("a")
→ 같은 결과여야 함
```

### 결합법칙 (Associativity)

```
(A + B) + C = A + (B + C)
```

### 멱등성 (Idempotency)

```
A + A = A

같은 연산 두 번 받아도 한 번과 같은 결과
→ 네트워크 재전송에도 안전
```

---

## 6. 인과적 순서 (Causal Ordering)

### 핵심 질문: 어떤 연산이 먼저 일어났는지 어떻게 알지?

```
A: "안녕" 입력
B: A의 "안녕"을 보고 → "반가워" 입력

이 순서는 지켜져야 함 (인과 관계)
```

```
A: "사과" 입력
B: "바나나" 입력 (동시에, 서로 모름)

이건 순서 상관없음 (동시적)
```

### 벡터 클록으로 관계 추적

```
A의 시계: [A:1, B:0]  "안녕" 전송
B의 시계: [A:1, B:1]  "안녕" 받고 "반가워" 전송
```

---

## 7. 주요 CRDT 종류

| 자료구조 | 설명 | 난이도 |
|---------|------|--------|
| **G-Counter** | 증가만 가능한 카운터 | ⭐ |
| **PN-Counter** | 증가/감소 가능한 카운터 | ⭐⭐ |
| **LWW-Register** | Last-Writer-Wins 레지스터 | ⭐⭐ |
| **OR-Set** | Observed-Remove Set | ⭐⭐⭐ |
| **RGA/YATA** | 텍스트/배열용 | ⭐⭐⭐⭐⭐ |

---

## 8. G-Counter 예시 (가장 기본)

### 핵심 아이디어

각 노드가 **자기 카운터만** 증가시킨다

```
노드A: { A: 3, B: 0, C: 0 }  → A가 3번 증가
노드B: { A: 0, B: 5, C: 0 }  → B가 5번 증가
노드C: { A: 0, B: 0, C: 2 }  → C가 2번 증가

전체 값 = 3 + 5 + 2 = 10
```

### 병합 방법

각 노드별로 **최댓값** 선택

```
노드A가 본 상태: { A: 3, B: 2, C: 1 }
노드B가 본 상태: { A: 1, B: 5, C: 2 }

병합 결과:        { A: 3, B: 5, C: 2 }  ← 각각 max
```

### 간단한 구현

```typescript
class GCounter {
  private counts: Map<string, number> = new Map();

  constructor(private nodeId: string) {}

  increment() {
    const current = this.counts.get(this.nodeId) ?? 0;
    this.counts.set(this.nodeId, current + 1);
  }

  value(): number {
    return [...this.counts.values()].reduce((a, b) => a + b, 0);
  }

  merge(other: GCounter) {
    for (const [nodeId, count] of other.counts) {
      const current = this.counts.get(nodeId) ?? 0;
      this.counts.set(nodeId, Math.max(current, count));
    }
  }
}
```

---

## 9. LWW (Last-Writer-Wins)

동시 수정 시 **타임스탬프가 큰 쪽이 승리**

```typescript
// 동시에 같은 키 수정
A: set('color', 'red')   // timestamp: 100
B: set('color', 'blue')  // timestamp: 101

// 결과: 'blue' (나중 timestamp가 승리)
```

**주의**: 동시 수정 시 하나는 사라짐

---

## 10. Tombstone (삭제 표시)

CRDT에서 삭제는 진짜 삭제가 아님

```typescript
// A가 삭제, B가 수정 (동시에)
A: delete('node-1')
B: update('node-1', { x: 100 })

// 만약 진짜 삭제했다면?
B의 update가 실패하거나 충돌
```

**해결: Tombstone**

```typescript
// 삭제 = "삭제됨" 표시
{ id: 'node-1', deleted: true, ... }

// 나중에 GC로 정리
```

---

## 다음 단계

- [02-yjs-overview.md](./02-yjs-overview.md) - Yjs 라이브러리 개요
- [03-yjs-api-reference.md](./03-yjs-api-reference.md) - Yjs API 레퍼런스
- [04-project-implementation.md](./04-project-implementation.md) - 프로젝트 구현 내용
