/**
 * PlatformStatus — Shows the connection status to the ALRaMaDy backend engines
 * Displays in the NotebookHeader as a small indicator
 */
import { usePlatformHealth } from "@/hooks/usePlatform";
import MaterialIcon from "./MaterialIcon";

export default function PlatformStatus() {
  const { connected, engines, isLoading } = usePlatformHealth();

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/50" title="جاري الاتصال بالمنصة...">
        <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
        <span className="text-[10px] text-muted-foreground">جاري الاتصال...</span>
      </div>
    );
  }

  const engineEntries = Object.entries(engines);
  const connectedCount = engineEntries.filter(([, e]) => e.connected).length;
  const totalEngines = engineEntries.length;

  if (connected) {
    const tooltip = engineEntries
      .map(([name, info]) => `${info.connected ? "✅" : "❌"} ${name}: ${info.url}`)
      .join("\n");

    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-success/10 border border-success/20 cursor-default"
        title={tooltip}
      >
        <div className="w-2 h-2 rounded-full bg-success animate-pulse-soft" />
        <span className="text-[10px] font-medium text-success">
          المنصة متصلة ({connectedCount}/{totalEngines})
        </span>
        <MaterialIcon icon="cloud_done" size={12} className="text-success" />
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-destructive/10 border border-destructive/20 cursor-default"
      title="غير متصل بالمنصة الخلفية"
    >
      <div className="w-2 h-2 rounded-full bg-destructive" />
      <span className="text-[10px] font-medium text-destructive">غير متصل</span>
      <MaterialIcon icon="cloud_off" size={12} className="text-destructive" />
    </div>
  );
}
