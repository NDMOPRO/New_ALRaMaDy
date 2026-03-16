/* RASID — Evidence Drawer
   Bottom sheet that shows evidence, audit trail, and verification for any job/artifact.
   Slides up with premium animation. */
import { useState } from 'react';
import MaterialIcon from './MaterialIcon';

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  evidence?: EvidenceData | null;
}

export interface EvidenceData {
  jobId: string;
  capability: string;
  status: 'verified' | 'pending' | 'failed';
  entries: Array<{
    id: string;
    type: 'input-snapshot' | 'output-snapshot' | 'diff' | 'metric' | 'log' | 'verification';
    label: string;
    value: string;
    timestamp: string;
    icon: string;
  }>;
  auditTrail: Array<{
    action: string;
    actor: string;
    time: string;
    detail?: string;
  }>;
}

export default function EvidenceDrawer({ isOpen, onClose, evidence }: EvidenceDrawerProps) {
  const [activeTab, setActiveTab] = useState<'evidence' | 'audit'>('evidence');

  if (!isOpen || !evidence) return null;

  const statusConfig = {
    verified: { label: 'تم التحقق', icon: 'verified', color: 'text-success', bg: 'bg-success/10' },
    pending: { label: 'قيد التحقق', icon: 'pending', color: 'text-warning', bg: 'bg-warning/10' },
    failed: { label: 'فشل التحقق', icon: 'error', color: 'text-danger', bg: 'bg-danger/10' },
  };

  const status = statusConfig[evidence.status];

  const typeIcons: Record<string, string> = {
    'input-snapshot': 'input',
    'output-snapshot': 'output',
    'diff': 'difference',
    'metric': 'speed',
    'log': 'receipt_long',
    'verification': 'verified',
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-fade-in" />
      <div
        className="relative z-10 w-full max-h-[60vh] bg-card/95 backdrop-blur-xl border-t border-border rounded-t-2xl shadow-2xl flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 px-4 pb-2 border-b border-border shrink-0">
          <div className={`w-8 h-8 rounded-xl ${status.bg} flex items-center justify-center`}>
            <MaterialIcon icon={status.icon} size={18} className={status.color} />
          </div>
          <div className="flex-1">
            <h3 className="text-[13px] font-bold text-foreground">حزمة الأدلة</h3>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium ${status.color}`}>{status.label}</span>
              <span className="text-[9px] text-muted-foreground">• {evidence.capability}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent hover:bg-accent/80 text-[10px] font-medium text-foreground transition-all">
              <MaterialIcon icon="download" size={13} />
              تصدير
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center transition-all">
              <MaterialIcon icon="close" size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 pt-2 shrink-0">
          <button
            onClick={() => setActiveTab('evidence')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              activeTab === 'evidence' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <MaterialIcon icon="fact_check" size={14} />
            الأدلة ({evidence.entries.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              activeTab === 'audit' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <MaterialIcon icon="history" size={14} />
            سجل التدقيق ({evidence.auditTrail.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'evidence' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {evidence.entries.map((entry, i) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-xl border border-border hover:border-primary/20 hover:bg-primary/3 transition-all cursor-pointer animate-stagger-in"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-lg bg-accent flex items-center justify-center">
                      <MaterialIcon icon={entry.icon || typeIcons[entry.type] || 'description'} size={13} className="text-muted-foreground" />
                    </div>
                    <span className="text-[11px] font-medium text-foreground flex-1 truncate">{entry.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{entry.value}</p>
                  <p className="text-[8px] text-muted-foreground/60 mt-1">{entry.timestamp}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="flex flex-col gap-0">
              {evidence.auditTrail.map((item, i) => (
                <div key={i} className="flex items-start gap-2 animate-stagger-in" style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-primary/40 mt-1.5" />
                    {i < evidence.auditTrail.length - 1 && <div className="w-0.5 flex-1 bg-border min-h-[20px]" />}
                  </div>
                  <div className="pb-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-foreground">{item.action}</span>
                      <span className="text-[9px] text-muted-foreground">• {item.actor}</span>
                    </div>
                    {item.detail && <p className="text-[10px] text-muted-foreground mt-0.5">{item.detail}</p>}
                    <p className="text-[8px] text-muted-foreground/60 mt-0.5">{item.time}</p>
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
