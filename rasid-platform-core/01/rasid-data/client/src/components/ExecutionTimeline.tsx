/* RASID — Execution Timeline
   Bottom bar showing real-time job execution progress across all capabilities.
   Expandable from a mini status bar to full timeline view. */
import { useState } from 'react';
import MaterialIcon from './MaterialIcon';

export interface TimelineJob {
  id: string;
  capability: string;
  capabilityIcon: string;
  title: string;
  status: 'queued' | 'running' | 'verifying' | 'completed' | 'failed' | 'paused';
  progress: number;
  stages: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
  }>;
  startedAt: string;
  message?: string;
}

interface ExecutionTimelineProps {
  jobs: TimelineJob[];
  onJobClick?: (jobId: string) => void;
  onEvidenceClick?: (jobId: string) => void;
}

export default function ExecutionTimeline({ jobs, onJobClick, onEvidenceClick }: ExecutionTimelineProps) {
  const [expanded, setExpanded] = useState(false);

  const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'verifying' || j.status === 'queued');
  const completedJobs = jobs.filter(j => j.status === 'completed' || j.status === 'failed');

  if (jobs.length === 0) return null;

  const statusConfig: Record<string, { color: string; bg: string; icon: string; label: string }> = {
    queued: { color: 'text-muted-foreground', bg: 'bg-muted/30', icon: 'schedule', label: 'في الانتظار' },
    running: { color: 'text-primary', bg: 'bg-primary/10', icon: 'play_circle', label: 'قيد التنفيذ' },
    verifying: { color: 'text-info', bg: 'bg-info/10', icon: 'verified', label: 'قيد التحقق' },
    completed: { color: 'text-success', bg: 'bg-success/10', icon: 'check_circle', label: 'مكتمل' },
    failed: { color: 'text-danger', bg: 'bg-danger/10', icon: 'error', label: 'فشل' },
    paused: { color: 'text-warning', bg: 'bg-warning/10', icon: 'pause_circle', label: 'متوقف' },
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      <div className="pointer-events-auto mx-2 sm:mx-4 mb-2">
        {/* Mini Bar (always visible) */}
        <div
          onClick={() => setExpanded(!expanded)}
          className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-lg cursor-pointer hover:shadow-xl transition-all"
        >
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Active indicator */}
            {activeJobs.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[11px] font-medium text-primary">{activeJobs.length} نشط</span>
              </div>
            )}

            {/* Progress chips */}
            <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {activeJobs.slice(0, 3).map(job => {
                const cfg = statusConfig[job.status];
                return (
                  <div key={job.id} className={`flex items-center gap-1 px-2 py-1 rounded-lg ${cfg.bg} shrink-0`}>
                    <MaterialIcon icon={job.capabilityIcon} size={12} className={cfg.color} />
                    <span className="text-[10px] font-medium text-foreground truncate max-w-[120px]">{job.title}</span>
                    <span className={`text-[9px] font-bold ${cfg.color}`}>{job.progress}%</span>
                  </div>
                );
              })}
              {activeJobs.length > 3 && (
                <span className="text-[9px] text-muted-foreground shrink-0">+{activeJobs.length - 3}</span>
              )}
            </div>

            {/* Completed count */}
            {completedJobs.length > 0 && (
              <div className="flex items-center gap-1">
                <MaterialIcon icon="check_circle" size={13} className="text-success" />
                <span className="text-[10px] text-success font-medium">{completedJobs.length}</span>
              </div>
            )}

            {/* Expand toggle */}
            <MaterialIcon icon={expanded ? 'expand_more' : 'expand_less'} size={16} className="text-muted-foreground" />
          </div>

          {/* Expanded Timeline */}
          {expanded && (
            <div className="border-t border-border px-3 py-2 max-h-[40vh] overflow-y-auto animate-fade-in">
              {jobs.map((job, i) => {
                const cfg = statusConfig[job.status];
                return (
                  <div
                    key={job.id}
                    className="flex items-start gap-2.5 py-2 border-b border-border/30 last:border-0 animate-stagger-in"
                    style={{ animationDelay: `${i * 0.04}s` }}
                  >
                    {/* Status icon */}
                    <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <MaterialIcon icon={cfg.icon} size={16} className={cfg.color} />
                    </div>

                    {/* Job info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-medium text-foreground truncate">{job.title}</span>
                        <span className={`text-[9px] font-medium ${cfg.color} px-1.5 py-0.5 rounded ${cfg.bg}`}>{cfg.label}</span>
                      </div>

                      {/* Stages */}
                      <div className="flex items-center gap-1 mt-1.5">
                        {job.stages.map((stage, si) => (
                          <div key={si} className="flex items-center gap-0.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              stage.status === 'completed' ? 'bg-success' :
                              stage.status === 'running' ? 'bg-primary animate-pulse' :
                              stage.status === 'failed' ? 'bg-danger' :
                              'bg-muted'
                            }`} />
                            <span className="text-[8px] text-muted-foreground">{stage.name}</span>
                            {si < job.stages.length - 1 && <div className="w-3 h-px bg-border mx-0.5" />}
                          </div>
                        ))}
                      </div>

                      {/* Progress bar */}
                      {(job.status === 'running' || job.status === 'verifying') && (
                        <div className="mt-1.5 h-1 bg-accent rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      )}

                      {job.message && (
                        <p className="text-[9px] text-muted-foreground mt-1">{job.message}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {onJobClick && (
                        <button
                          onClick={e => { e.stopPropagation(); onJobClick(job.id); }}
                          className="w-6 h-6 rounded-lg hover:bg-accent flex items-center justify-center"
                        >
                          <MaterialIcon icon="open_in_new" size={13} className="text-muted-foreground" />
                        </button>
                      )}
                      {onEvidenceClick && job.status === 'completed' && (
                        <button
                          onClick={e => { e.stopPropagation(); onEvidenceClick(job.id); }}
                          className="w-6 h-6 rounded-lg hover:bg-accent flex items-center justify-center"
                        >
                          <MaterialIcon icon="fact_check" size={13} className="text-success" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
