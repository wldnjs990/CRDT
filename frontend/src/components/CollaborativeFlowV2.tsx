import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type { Connection, NodeChange, EdgeChange, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useYjsSync } from '../hooks/useYjsSync';
import { NodeSidebar } from './NodeSidebar';

interface CollaborativeFlowProps {
  roomId: string;
}

export function CollaborativeFlowV2({ roomId }: CollaborativeFlowProps) {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    addNode,
    updateNode,
    deleteNode,
    isConnected,
    connectionStatus,
  } = useYjsSync({ roomId });

  // 선택된 노드 (사이드바용)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // 노드 변경 (드래그, 선택 등)
  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      const updatedNodes = applyNodeChanges(changes, nodes);
      setNodes(updatedNodes);

      // 선택된 노드 상태 업데이트
      if (selectedNode) {
        const updated = updatedNodes.find(n => n.id === selectedNode.id);
        if (updated) {
          setSelectedNode(updated);
        }
      }
    },
    [nodes, setNodes, selectedNode]
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

  // 노드 클릭 → 사이드바 열기
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
    },
    []
  );

  // 패널 클릭 시 사이드바 닫기
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // 노드 추가 버튼 핸들러
  const handleAddNode = useCallback(() => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      position: {
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
      },
      data: {
        label: `Node ${nodes.length + 1}`,
        description: '',
        color: '#ffffff',
      },
      type: 'default',
      style: { backgroundColor: '#ffffff' },
    };

    addNode(newNode);
  }, [nodes.length, addNode]);

  // 노드 업데이트 핸들러 (사이드바에서 호출)
  const handleNodeUpdate = useCallback(
    (id: string, updates: Partial<Node>) => {
      updateNode(id, updates);
      // 선택된 노드 상태도 업데이트
      if (selectedNode && selectedNode.id === id) {
        setSelectedNode(prev => prev ? { ...prev, ...updates } : null);
      }
    },
    [updateNode, selectedNode]
  );

  // 노드 삭제 핸들러
  const handleNodeDelete = useCallback(
    (id: string) => {
      deleteNode(id);
      setSelectedNode(null);
    },
    [deleteNode]
  );

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* 연결 상태 표시 */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: selectedNode ? 320 : 10,
          zIndex: 1001,
          padding: '8px 16px',
          borderRadius: 4,
          backgroundColor: isConnected ? '#10b981' : '#ef4444',
          color: 'white',
          fontSize: 14,
          transition: 'right 0.2s ease',
        }}
      >
        {connectionStatus === 'connecting' && '연결 중...'}
        {connectionStatus === 'connected' && '연결됨 ✓'}
        {connectionStatus === 'disconnected' && '연결 끊김'}
      </div>

      {/* 노드 추가 버튼 */}
      <button
        onClick={handleAddNode}
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1001,
          padding: '10px 20px',
          borderRadius: 4,
          backgroundColor: '#3b82f6',
          color: 'white',
          fontSize: 14,
          fontWeight: 500,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        + 노드 추가
      </button>

      {/* 사용법 안내 */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 10,
          zIndex: 1001,
          padding: '8px 16px',
          borderRadius: 4,
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          fontSize: 12,
        }}
      >
        <div>드래그: 노드 이동</div>
        <div>클릭: 노드 편집</div>
        <div>연결: 핸들 드래그</div>
      </div>

      {/* 노드 개수 표시 */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          zIndex: 1001,
          padding: '8px 16px',
          borderRadius: 4,
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          fontSize: 12,
        }}
      >
        노드: {nodes.length} | 엣지: {edges.length}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {/* 노드 편집 사이드바 */}
      <NodeSidebar
        node={selectedNode}
        onUpdate={handleNodeUpdate}
        onDelete={handleNodeDelete}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}
