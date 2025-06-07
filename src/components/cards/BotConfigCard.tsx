import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { BotConfig } from '@/types';
import { getBotConfiguration } from '@/lib/firestoreService';
import { Chip } from '@/components/ui/chip'; // Assuming Chip is a new simple component
import { CheckSquare, XSquare } from 'lucide-react';

export async function BotConfigCard() {
  const config: BotConfig = await getBotConfiguration();

  const renderValue = (value: any) => {
    if (typeof value === 'boolean') {
      return value ? 
        <span className="flex items-center text-green-500"><CheckSquare className="h-4 w-4 mr-1" /> Enabled</span> : 
        <span className="flex items-center text-red-500"><XSquare className="h-4 w-4 mr-1" /> Disabled</span>;
    }
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((item, index) => (
            <Chip key={index}>{String(item)}</Chip>
          ))}
        </div>
      );
    }
    if (value === undefined || value === null) {
      return <span className="text-muted-foreground italic">Not set</span>;
    }
    return String(value);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Bot Configuration</CardTitle>
        <CardDescription>Current settings for the trading bot. Read-only from dashboard.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
      {Object.keys(config).length === 0 ? (
           <div className="flex items-center justify-center h-full">
             <p className="text-muted-foreground">No configuration data available.</p>
           </div>
        ) : (
        <ScrollArea className="h-[300px] pr-4"> {/* Adjust height as needed */}
          <div className="space-y-3">
            {Object.entries(config).map(([key, value]) => (
              // Do not display sensitive keys like API keys or Telegram tokens
              (key.toLowerCase().includes('api') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) ? null : (
                <div key={key} className="flex justify-between items-start text-sm pb-2 border-b border-border/60 last:border-b-0">
                  <span className="font-medium text-muted-foreground capitalize break-words mr-2">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                  </span>
                  <span className="text-right text-foreground break-all">{renderValue(value)}</span>
                </div>
              )
            ))}
          </div>
        </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
