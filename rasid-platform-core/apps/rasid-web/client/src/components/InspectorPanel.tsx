/* RASID — Inspector Panel
   Right-side drawer that shows properties, actions, lineage for any selected artifact/source.
   Slides in from the left (RTL layout) with glassmorphism. */
import { useState } from 'react';
import MaterialIcon from './MaterialIcon';
import { useTheme } from '@/contexts/ThemeContext';

interface InspectorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  target?: InspectorTarget | null;
}

export interface InspectorTarget {
  id: string;
  type: 'source' | 'artifact' | 'widget' | 'slide' | 'section';
  title: string;
  icon: string;
  properties: Record<string, string | number>;
  actions: Array<{ id: string; label: string; icon: string; color?: string }>;
  lineage: Array<{ id: string; label: string; icon: string; time: string }>;
  warnings?: string[];
}

export default function InspectorPanel({ isOpen, onClose, target }: InspectorPanelProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'properties' | 'actions' | 'lineage'>('properties');

  if (!isOpen || !target) return null;

  const tabs = [
    { id: 'properties' as const, label: 'الخصائص', icon: 'tune' },
    { id: 'actions' as const, label: 'الإجراءات', icon: 'bolt' },
    { id: 'lineage' as const, label: 'السلسلة', icon: 'account_tree' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-fade-in" />
      <div
        className="relative z-10 h-full w-[340px] max-w-[90vw] bg-card/95 backdrop-blur-xl border-r border-border shadow-2xl animate-slide-in-left flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-border shrink-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <MaterialIcon icon={target.icon} size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-bold text-foreground truncate">{target.title}</h3>
            <p className="text-[10px] text-muted-foreground">{target.type === 'source' ? 'مصدر بيانات' : 'مخرج'}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center transition-all">
            <MaterialIcon icon="close" size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Warnings */}
        {target.warnings && target.warnings.length > 0 && (
          <div className="mx-3 mt-2 p-2 rounded-xl bg-warning/8 border border-warning/20">
            {target.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[10px] text-warning">
                <MaterialIcon icon="warning" size={13} className="shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-0.5 px-3 pt-2 shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <MaterialIcon icon={tab.icon} size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === 'properties' && (
            <div className="flex flex-col gap-2 animate-fade-in">
              {Object.entries(target.properties).map(([key, value], i) => (
                <div key={key} className="flex items-center justify-between p-2 rounded-xl bg-accent/30 animate-stagger-in" style={{ animationDelay: `${i * 0.04}s` }}>
                  <span className="text-[11px] text-muted-foreground">{key}</span>
                  <span className="text-[11px] font-medium text-foreground">{String(value)}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="flex flex-col gap-1.5 animate-fade-in">
              {target.actions.map((action, i) => (
                <button
                  key={action.id}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-right animate-stagger-in"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${action.color ? `bg-${action.color}/10` : 'bg-primary/10'}`}>
                    <MaterialIcon icon={action.icon} size={15} className={action.color ? `text-${action.color}` : 'text-primary'} />
                  </div>
                  <span className="text-[12px] font-medium text-foreground">{action.label}</span>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'lineage' && (
            <div className="flex flex-col gap-0 animate-fade-in">
              {target.lineage.map((item, i) => (
                <div key={item.id} className="flex items-start gap-2 animate-stagger-in" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <MaterialIcon icon={item.icon} size={13} className="text-primary" />
                    </div>
                    {i < target.lineage.length - 1 && <div className="w-0.5 h-6 bg-border" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-[11px] font-medium text-foreground">{item.label}</p>
                    <p className="text-[9px] text-muted-foreground">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
