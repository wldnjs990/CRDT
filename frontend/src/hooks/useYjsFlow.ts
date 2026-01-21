import { useCallback, useEffect, useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

// y-socket 클라이언트-서버 둘 다 사용
// 서버 URL - 나중에 y-sweet이든 Node.js든 바꿔도 됨
const WS_URL = "ws://localhost:1234";

interface UseYjsFlowOptions {
  roomId: string;
}

interface UseYjsFlowReturn {
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
  connectionStatus: "connecting" | "connected" | "disconnected";
}

export function useYjsFlow({ roomId }: UseYjsFlowOptions): UseYjsFlowReturn {
  const [nodes, setNodesState] = useState<Node[]>([]);
  const [edges, setEdgesState] = useState<Edge[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");

  // Yjs 인스턴스 (컴포넌트 생명주기 동안 유지)
  const [yjsState] = useState(() => {
    const ydoc = new Y.Doc();
    const yNodes = ydoc.getMap<Node>("nodes");
    const yEdges = ydoc.getMap<Edge>("edges");
    return { ydoc, yNodes, yEdges };
  });

  const { ydoc, yNodes, yEdges } = yjsState;

  // WebSocket 연결 설정
  useEffect(() => {
    const provider = new WebsocketProvider(WS_URL, roomId, ydoc);

    provider.on("status", (event: { status: string }) => {
      setIsConnected(event.status === "connected");
      setConnectionStatus(
        event.status as "connecting" | "connected" | "disconnected",
      );
    });

    // Yjs 데이터 변경 감지 → React 상태 업데이트
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
      provider.destroy();
    };
  }, [roomId, ydoc, yNodes, yEdges]);

  // 노드 전체 설정 (React Flow의 onNodesChange용)
  const setNodes = useCallback(
    (newNodes: Node[]) => {
      ydoc.transact(() => {
        // 기존 노드 중 새 배열에 없는 것 삭제
        const newIds = new Set(newNodes.map((n) => n.id));
        yNodes.forEach((_, id) => {
          if (!newIds.has(id)) {
            yNodes.delete(id);
          }
        });
        // 새 노드 추가/업데이트
        newNodes.forEach((node) => {
          yNodes.set(node.id, node);
        });
      });
    },
    [ydoc, yNodes],
  );

  // 엣지 전체 설정
  const setEdges = useCallback(
    (newEdges: Edge[]) => {
      ydoc.transact(() => {
        const newIds = new Set(newEdges.map((e) => e.id));
        yEdges.forEach((_, id) => {
          if (!newIds.has(id)) {
            yEdges.delete(id);
          }
        });
        newEdges.forEach((edge) => {
          yEdges.set(edge.id, edge);
        });
      });
    },
    [ydoc, yEdges],
  );

  // 개별 노드 추가
  const addNode = useCallback(
    (node: Node) => {
      yNodes.set(node.id, node);
    },
    [yNodes],
  );

  // 노드 업데이트 (위치 변경 등)
  const updateNode = useCallback(
    (id: string, updates: Partial<Node>) => {
      const existing = yNodes.get(id);
      if (existing) {
        yNodes.set(id, { ...existing, ...updates });
      }
    },
    [yNodes],
  );

  // 노드 삭제
  const deleteNode = useCallback(
    (id: string) => {
      yNodes.delete(id);
      // 연결된 엣지도 삭제
      yEdges.forEach((edge, edgeId) => {
        if (edge.source === id || edge.target === id) {
          yEdges.delete(edgeId);
        }
      });
    },
    [yNodes, yEdges],
  );

  // 엣지 추가
  const addEdge = useCallback(
    (edge: Edge) => {
      yEdges.set(edge.id, edge);
    },
    [yEdges],
  );

  // 엣지 삭제
  const deleteEdge = useCallback(
    (id: string) => {
      yEdges.delete(id);
    },
    [yEdges],
  );

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
