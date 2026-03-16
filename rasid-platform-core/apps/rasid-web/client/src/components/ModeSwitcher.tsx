/* RASID — Mode Switcher
   Easy/Advanced mode toggle, required by all engines.
   Compact pill with animated transition. */
import MaterialIcon from './MaterialIcon';

interface ModeSwitcherProps {
  mode: 'easy' | 'advanced';
  onToggle: (mode: 'easy' | 'advanced') => void;
  className?: string;
}

export default function ModeSwitcher({ mode, onToggle, className = '' }: ModeSwitcherProps) {
  return (
    <div className={`flex items-center gap-0.5 bg-accent/40 rounded-lg p-0.5 ${className}`}>
      <button
        onClick={() => onToggle('easy')}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
          mode === 'easy'
            ? 'bg-card text-primary shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <MaterialIcon icon="auto_awesome" size={12} />
        سهل
      </button>
      <button
        onClick={() => onToggle('advanced')}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
          mode === 'advanced'
            ? 'bg-card text-primary shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <MaterialIcon icon="tune" size={12} />
        متقدم
      </button>
    </div>
  );
}
