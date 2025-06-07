import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { BotLog } from '@/types';
import { getBotLogs } from '@/lib/firestoreService';
import { Info, AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export async function BotLogsCard() {
  const logs: BotLog[] = await getBotLogs(100); // Fetch last 100 logs

  const getLogLevelClass = (level: BotLog['level']) => {
    switch (level) {
      case 'INFO':
        return 'text-blue-400';
      case 'WARN':
        return 'text-yellow-400';
      case 'ERROR':
        return 'text-red-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const getLogLevelIcon = (level: BotLog['level']) => {
    switch (level) {
      case 'INFO':
        return <Info className="h-4 w-4 mr-2 flex-shrink-0" />;
      case 'WARN':
        return <ShieldAlert className="h-4 w-4 mr-2 flex-shrink-0" />;
      case 'ERROR':
        return <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />;
      default:
        return null;
    }
  };
  
  const formatTimestamp = (date: Date) => {
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Bot Activity Logs</CardTitle>
        <CardDescription>Recent events and messages from the trading bot.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">No logs available at the moment.</p>
            </div>
          ) : (
        <ScrollArea className="h-[300px] pr-4"> {/* Adjust height as needed */}
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className={cn("flex items-start text-xs p-2 rounded-md", 
                log.level === 'ERROR' ? 'bg-red-500/10' : log.level === 'WARN' ? 'bg-yellow-500/10' : 'bg-muted/30'
              )}>
                <div className={cn("flex items-center", getLogLevelClass(log.level))}>
                  {getLogLevelIcon(log.level)}
                  <span className="font-mono text-muted-foreground/80 mr-2">{formatTimestamp(log.timestamp)}</span>
                  <span className="font-semibold mr-1">{log.level}:</span>
                </div>
                <span className="break-words flex-grow">{log.message}</span>
                {log.tradeId && <span className="ml-2 text-xs text-muted-foreground">(Trade: {log.tradeId})</span>}
              </div>
            ))}
          </div>
        </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
