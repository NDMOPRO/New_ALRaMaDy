/* ═══════════════════════════════════════════════════════════════
   WorkspaceView — 3 Tabs Only: راصد الذكي / بياناتي / مكتبتي
   REQ-001: Only 3 workspace tabs
   ═══════════════════════════════════════════════════════════════ */
import ExcelEngine from './ExcelEngine';
import LibraryEngine from './LibraryEngine';

interface WorkspaceViewProps {
  viewId: string;
}

export default function WorkspaceView({ viewId }: WorkspaceViewProps) {
  const renderEngine = () => {
    switch (viewId) {
      case 'data': return <ExcelEngine />;
      case 'library': return <LibraryEngine />;
      default: return <ExcelEngine />;
    }
  };
  return (
    <div key={viewId} className="h-full animate-engine-enter">
      {renderEngine()}
    </div>
  );
}
