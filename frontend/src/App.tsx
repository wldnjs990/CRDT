import { CollaborativeFlowV2 } from './components/CollaborativeFlowV2';

export default function App() {
  // roomId를 URL에서 가져오거나 기본값 사용
  const roomId = new URLSearchParams(window.location.search).get('room') || 'default-room';

  return <CollaborativeFlowV2 roomId={roomId} />;
}
