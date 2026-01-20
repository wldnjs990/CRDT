import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useYjsFlow } from '../hooks/useYjsFlow';

interface CollaborativeFlowProps {
  roomId: string;
}

export function CollaborativeFlow({ roomId }: CollaborativeFlowProps) {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    addNode,
    isConnected,
    connectionStatus,
  } = useYjsFlow({ roomId });

  // 노드 변경 (드래그, 선택 등)
  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      const updatedNodes = applyNodeChanges(changes, nodes);
      setNodes(updatedNodes);
    },
    [nodes, setNodes]
  );

  // 엣지 변경
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const updatedEdges = applyEdgeChanges(changes, edges);
      setEdges(updatedEdges);
    },
    [edges, setEdges]
  );

  // 새 연결 생성
  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdges = addEdge(connection, edges);
      setEdges(newEdges);
    },
    [edges, setEdges]
  );

  // 새 노드 추가 (더블클릭)
  const onDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      // React Flow 패널 영역에서만 동작
      if (!target.classList.contains('react-flow__pane')) return;

      const bounds = target.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };

      const newNode: Node = {
        id: `node-${Date.now()}`,
        position,
        data: { label: `Node ${nodes.length + 1}` },
        type: 'default',
      };

      addNode(newNode);
    },
    [nodes.length, addNode]
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {/* 연결 상태 표시 */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          padding: '8px 16px',
          borderRadius: 4,
          backgroundColor: isConnected ? '#10b981' : '#ef4444',
          color: 'white',
          fontSize: 14,
        }}
      >
        {connectionStatus === 'connecting' && '연결 중...'}
        {connectionStatus === 'connected' && '연결됨 ✓'}
        {connectionStatus === 'disconnected' && '연결 끊김'}
      </div>

      {/* 사용법 안내 */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1000,
          padding: '8px 16px',
          borderRadius: 4,
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          fontSize: 12,
        }}
      >
        <div>더블클릭: 노드 추가</div>
        <div>드래그: 노드 이동</div>
        <div>노드 연결: 핸들 드래그</div>
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
