import { useCallback, useEffect, useRef, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import * as Y from 'yjs';

const WS_URL = 'ws://localhost:1234';

interface UseYjsSyncOptions {
  roomId: string;
}

interface UseYjsSyncReturn {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  updateNode: (id: string, updates: Partial<Node>) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: Edge) => void;
  deleteEdge: (id: string) => void;
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
}

/**
 * y-websocket 없이 순수 Y.Doc + 일반 WebSocket으로 CRDT 동기화
 */
export function useYjsSync({ roomId }: UseYjsSyncOptions): UseYjsSyncReturn {
  const [nodes, setNodesState] = useState<Node[]>([]);
  const [edges, setEdgesState] = useState<Edge[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isCleanedUpRef = useRef(false);

  // Yjs 인스턴스 (컴포넌트 생명주기 동안 유지)
  const ydocRef = useRef<Y.Doc | null>(null);
  const yNodesRef = useRef<Y.Map<Node> | null>(null);
  const yEdgesRef = useRef<Y.Map<Edge> | null>(null);

  // 초기화 (한 번만)
  if (!ydocRef.current) {
    ydocRef.current = new Y.Doc();
    yNodesRef.current = ydocRef.current.getMap<Node>('nodes');
    yEdgesRef.current = ydocRef.current.getMap<Edge>('edges');
  }

  const ydoc = ydocRef.current;
  const yNodes = yNodesRef.current!;
  const yEdges = yEdgesRef.current!;

  // WebSocket 연결 및 정리
  useEffect(() => {
    isCleanedUpRef.current = false;

    const connect = () => {
      // 이미 정리된 경우 연결하지 않음
      if (isCleanedUpRef.current) return;

      // 기존 연결이 있으면 닫기
      if (wsRef.current) {
        wsRef.current.close();
      }

      setConnectionStatus('connecting');

      const ws = new WebSocket(`${WS_URL}/${roomId}`);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        if (isCleanedUpRef.current) {
          ws.close();
          return;
        }

        setIsConnected(true);
        setConnectionStatus('connected');
        console.log(`[연결됨] 룸: ${roomId}`);

        // 연결 시 현재 상태 벡터 전송
        const stateVector = Y.encodeStateVector(ydoc);
        const message = new Uint8Array(stateVector.length + 1);
        message[0] = 0; // type: stateVector
        message.set(stateVector, 1);
        ws.send(message);
      };

      ws.onmessage = (event) => {
        if (isCleanedUpRef.current) return;

        const data = new Uint8Array(event.data);
        const messageType = data[0];
        const payload = data.slice(1);

        if (messageType === 0) {
          // 상태 벡터 요청 → 내 변경분 전송
          const update = Y.encodeStateAsUpdate(ydoc, payload);
          if (update.length > 0) {
            const response = new Uint8Array(update.length + 1);
            response[0] = 1; // type: update
            response.set(update, 1);
            ws.send(response);
          }
        } else if (messageType === 1) {
          // 업데이트 수신 → 문서에 적용
          Y.applyUpdate(ydoc, payload, 'remote');
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        console.log(`[연결 끊김] 룸: ${roomId}`);

        // 정리되지 않은 경우에만 재연결
        if (!isCleanedUpRef.current) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            console.log('[재연결 시도]');
            connect();
          }, 2000);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket 에러]', error);
      };
    };

    // 로컬 변경 → 서버로 전송
    const handleUpdate = (update: Uint8Array, origin: unknown) => {
      // 원격에서 온 변경은 다시 전송하지 않음
      if (origin === 'remote') return;

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const message = new Uint8Array(update.length + 1);
        message[0] = 1; // type: update
        message.set(update, 1);
        ws.send(message);
      }
    };

    ydoc.on('update', handleUpdate);
    connect();

    return () => {
      isCleanedUpRef.current = true;
      ydoc.off('update', handleUpdate);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [roomId, ydoc]);

  // Yjs 데이터 변경 → React 상태 업데이트
  useEffect(() => {
    const updateNodes = () => {
      const nodeArray = Array.from(yNodes.values());
      setNodesState(nodeArray);
    };

    const updateEdges = () => {
      const edgeArray = Array.from(yEdges.values());
      setEdgesState(edgeArray);
    };

    yNodes.observe(updateNodes);
    yEdges.observe(updateEdges);

    // 초기 데이터 로드
    updateNodes();
    updateEdges();

    return () => {
      yNodes.unobserve(updateNodes);
      yEdges.unobserve(updateEdges);
    };
  }, [yNodes, yEdges]);

  // 노드 전체 설정
  const setNodes = useCallback((newNodes: Node[]) => {
    ydoc.transact(() => {
      const newIds = new Set(newNodes.map(n => n.id));
      yNodes.forEach((_, id) => {
        if (!newIds.has(id)) {
          yNodes.delete(id);
        }
      });
      newNodes.forEach(node => {
        yNodes.set(node.id, node);
      });
    });
  }, [ydoc, yNodes]);

  // 엣지 전체 설정
  const setEdges = useCallback((newEdges: Edge[]) => {
    ydoc.transact(() => {
      const newIds = new Set(newEdges.map(e => e.id));
      yEdges.forEach((_, id) => {
        if (!newIds.has(id)) {
          yEdges.delete(id);
        }
      });
      newEdges.forEach(edge => {
        yEdges.set(edge.id, edge);
      });
    });
  }, [ydoc, yEdges]);

  // 개별 노드 추가
  const addNode = useCallback((node: Node) => {
    yNodes.set(node.id, node);
  }, [yNodes]);

  // 노드 업데이트
  const updateNode = useCallback((id: string, updates: Partial<Node>) => {
    const existing = yNodes.get(id);
    if (existing) {
      yNodes.set(id, { ...existing, ...updates });
    }
  }, [yNodes]);

  // 노드 삭제
  const deleteNode = useCallback((id: string) => {
    ydoc.transact(() => {
      yNodes.delete(id);
      // 연결된 엣지도 삭제
      yEdges.forEach((edge, edgeId) => {
        if (edge.source === id || edge.target === id) {
          yEdges.delete(edgeId);
        }
      });
    });
  }, [ydoc, yNodes, yEdges]);

  // 엣지 추가
  const addEdge = useCallback((edge: Edge) => {
    yEdges.set(edge.id, edge);
  }, [yEdges]);

  // 엣지 삭제
  const deleteEdge = useCallback((id: string) => {
    yEdges.delete(id);
  }, [yEdges]);

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
    connectionStatus,
  };
}
