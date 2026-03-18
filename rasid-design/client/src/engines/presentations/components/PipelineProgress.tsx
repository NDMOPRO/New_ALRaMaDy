/**
 * PipelineProgress — AI Generation pipeline overlay
 * E02-0005: 8-stage pipeline with real-time progress
 */

import { motion } from 'framer-motion';
import { Loader2, Check, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { usePresentationStore } from '../store';

export function PipelineProgress() {
  const { pipeline, isGenerating, cancelGeneration } = usePresentationStore();

  const statusIcon = (status: string) => {
    switch (status) {
      case 'done': return <Check className="w-3.5 h-3.5 text-green-500" />;
      case 'active': return <Loader2 className="w-3.5 h-3.5 text-gold animate-spin" />;
      case 'error': return <X className="w-3.5 h-3.5 text-red-500" />;
      default: return <Clock className="w-3.5 h-3.5 text-muted-foreground/40" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-card border border-border rounded-xl shadow-2xl p-6 w-[420px] max-w-[90vw]"
        dir="rtl"
      >
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-foreground">جاري التوليد الذكي</h3>
          <p className="text-sm text-muted-foreground mt-1">{pipeline.currentStep}</p>
        </div>

        <Progress value={pipeline.progress} className="h-2 mb-4" />

        <div className="space-y-2 mb-4">
          {pipeline.steps.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors ${
                step.status === 'active' ? 'bg-gold/10' : ''
              }`}
            >
              {statusIcon(step.status)}
              <span className={`text-sm flex-1 ${
                step.status === 'active' ? 'font-semibold text-foreground' :
                step.status === 'done' ? 'text-muted-foreground line-through' :
                'text-muted-foreground/60'
              }`}>
                {step.nameAr}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {step.status === 'done' ? '100%' : step.status === 'active' ? `${step.progress}%` : ''}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={cancelGeneration} className="gap-2">
            <X className="w-3.5 h-3.5" />
            إلغاء
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
