/* ═══════════════════════════════════════════════════════════════
   WorkspaceView — All Engines Connected
   Renders the appropriate engine based on the active workspace view
   ═══════════════════════════════════════════════════════════════ */
import { lazy, Suspense } from 'react';
import ExcelEngine from './ExcelEngine';
import LibraryEngine from './LibraryEngine';
import DashboardEngine from './DashboardEngine';
import ReportsEngine from './ReportsEngine';
import PresentationsEngine from './PresentationsEngine';
import TranslationEngine from './TranslationEngine';
import ExtractionEngine from './ExtractionEngine';
import VisualMatchEngine from './VisualMatchEngine';
import MaterialIcon from './MaterialIcon';

function EngineLoader() {
  return (
    <div className="h-full flex items-center justify-center">
      <MaterialIcon icon="progress_activity" size={32} className="text-primary animate-icon-spin" />
    </div>
  );
}

interface WorkspaceViewProps {
  viewId: string;
}

export default function WorkspaceView({ viewId }: WorkspaceViewProps) {
  const renderEngine = () => {
    switch (viewId) {
      case 'dashboard': return <DashboardEngine />;
      case 'reports': return <ReportsEngine />;
      case 'presentations': return <PresentationsEngine />;
      case 'data': return <ExcelEngine />;
      case 'library': return <LibraryEngine />;
      case 'translation': return <TranslationEngine />;
      case 'extraction': return <ExtractionEngine />;
      case 'matching': return <VisualMatchEngine />;
      default: return <ExcelEngine />;
    }
  };
  return (
    <div key={viewId} className="h-full animate-engine-enter">
      {renderEngine()}
    </div>
  );
}
