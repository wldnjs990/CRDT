import { useState } from 'react';
import type { Node } from '@xyflow/react';

interface NodeSidebarProps {
  node: Node | null;
  onUpdate: (id: string, updates: Partial<Node>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function NodeSidebar({ node, onUpdate, onDelete, onClose }: NodeSidebarProps) {
  // node.id가 바뀔 때만 key를 변경하여 내부 상태 초기화
  const nodeId = node?.id ?? null;

  if (!node) return null;

  return (
    <NodeSidebarContent
      key={nodeId}
      node={node}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onClose={onClose}
    />
  );
}

// 실제 사이드바 컨텐츠 (key로 리셋되어 초기값이 적용됨)
function NodeSidebarContent({ node, onUpdate, onDelete, onClose }: {
  node: Node;
  onUpdate: (id: string, updates: Partial<Node>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState((node.data?.label as string) || '');
  const [description, setDescription] = useState((node.data?.description as string) || '');
  const [color, setColor] = useState((node.data?.color as string) || '#ffffff');

  const handleLabelChange = (value: string) => {
    setLabel(value);
    onUpdate(node.id, {
      data: { ...node.data, label: value },
    });
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    onUpdate(node.id, {
      data: { ...node.data, description: value },
    });
  };

  const handleColorChange = (value: string) => {
    setColor(value);
    onUpdate(node.id, {
      data: { ...node.data, color: value },
      style: { ...node.style, backgroundColor: value },
    });
  };

  const handleDelete = () => {
    onDelete(node.id);
    onClose();
  };

  return (
    <div style={styles.sidebar}>
      <div style={styles.header}>
        <h3 style={styles.title}>노드 편집</h3>
        <button onClick={onClose} style={styles.closeButton}>
          ✕
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.field}>
          <label style={styles.label}>ID</label>
          <input
            type="text"
            value={node.id}
            disabled
            style={{ ...styles.input, backgroundColor: '#f0f0f0' }}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>이름</label>
          <input
            type="text"
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            style={styles.input}
            placeholder="노드 이름 입력"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>설명</label>
          <textarea
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            style={styles.textarea}
            placeholder="노드 설명 입력"
            rows={4}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>배경색</label>
          <div style={styles.colorRow}>
            <input
              type="color"
              value={color}
              onChange={(e) => handleColorChange(e.target.value)}
              style={styles.colorInput}
            />
            <input
              type="text"
              value={color}
              onChange={(e) => handleColorChange(e.target.value)}
              style={{ ...styles.input, flex: 1 }}
            />
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>위치</label>
          <div style={styles.positionRow}>
            <span>X: {Math.round(node.position.x)}</span>
            <span>Y: {Math.round(node.position.y)}</span>
          </div>
        </div>

        <button onClick={handleDelete} style={styles.deleteButton}>
          노드 삭제
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 300,
    height: '100%',
    backgroundColor: 'white',
    borderLeft: '1px solid #e0e0e0',
    boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 4,
  },
  content: {
    padding: 16,
    overflowY: 'auto',
    flex: 1,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    marginBottom: 6,
    fontSize: 13,
    fontWeight: 500,
    color: '#555',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: 4,
    fontSize: 14,
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: 4,
    fontSize: 14,
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  colorRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  colorInput: {
    width: 40,
    height: 36,
    padding: 0,
    border: '1px solid #ddd',
    borderRadius: 4,
    cursor: 'pointer',
  },
  positionRow: {
    display: 'flex',
    gap: 16,
    padding: '8px 12px',
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
    fontSize: 14,
  },
  deleteButton: {
    width: '100%',
    padding: '10px 16px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    fontSize: 14,
    cursor: 'pointer',
    marginTop: 16,
  },
};
