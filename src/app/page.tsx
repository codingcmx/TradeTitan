import { Header } from '@/components/layout/Header';
import { RealtimeTradesCard } from '@/components/cards/RealtimeTradesCard';
import { TradeHistoryCard } from '@/components/cards/TradeHistoryCard';
import { BotConfigCard } from '@/components/cards/BotConfigCard';
import { BotLogsCard } from '@/components/cards/BotLogsCard';
import { StatCard } from '@/components/cards/StatCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, History, Settings, ListChecks, DollarSign, Percent, BarChart2 } from 'lucide-react';
import { getKeyMetrics } from '@/lib/firestoreService'; // Assuming this fetches PnL, Win Rate etc.
import type { KeyMetric } from '@/types';


export default async function DashboardPage() {
  const metrics = await getKeyMetrics();

  const summaryStats: KeyMetric[] = [
    { label: 'Total PnL', value: `$${metrics.totalPnl.toLocaleString()}`, icon: DollarSign, trendDirection: metrics.totalPnl >= 0 ? 'up' : 'down' },
    { label: 'Win Rate', value: `${metrics.winRate}%`, icon: Percent, trendDirection: metrics.winRate >= 50 ? 'up' : 'down' },
    { label: 'Total Trades', value: metrics.totalTrades, icon: BarChart2 },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {summaryStats.map((stat) => (
            <StatCard 
              key={stat.label} 
              title={stat.label} 
              value={stat.value.toString()} 
              icon={stat.icon} 
              trendDirection={stat.changeType === 'positive' ? 'up' : stat.changeType === 'negative' ? 'down' : undefined}
              trend={stat.change}
            />
          ))}
        </div>

        <Tabs defaultValue="live" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-4 bg-card border border-border shadow-sm">
            <TabsTrigger value="live" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              <TrendingUp className="mr-2 h-5 w-5" /> Live View
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              <History className="mr-2 h-5 w-5" /> Trade History
            </TabsTrigger>
            <TabsTrigger value="config" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              <Settings className="mr-2 h-5 w-5" /> Configuration
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              <ListChecks className="mr-2 h-5 w-5" /> Bot Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live">
            <RealtimeTradesCard />
          </TabsContent>
          <TabsContent value="history">
            {/* @ts-expect-error Server Component */}
            <TradeHistoryCard />
          </TabsContent>
          <TabsContent value="config">
            {/* @ts-expect-error Server Component */}
            <BotConfigCard />
          </TabsContent>
          <TabsContent value="logs">
            {/* @ts-expect-error Server Component */}
            <BotLogsCard />
          </TabsContent>
        </Tabs>
      </main>
      <footer className="py-4 px-8 text-center text-xs text-muted-foreground border-t border-border">
        TradeWatch Dashboard &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
