
import { Header } from '@/components/layout/Header';
import { TradeHistoryCard } from '@/components/cards/TradeHistoryCard';
import { StrategyDevelopmentCard } from '@/components/cards/StrategyDevelopmentCard';
import { StrategyAssistantCard } from '@/components/cards/StrategyAssistantCard'; // Reinstated
import { StatCard } from '@/components/cards/StatCard';
import { AccountBalanceCard } from '@/components/cards/AccountBalanceCard';
import { PlaceTradeCard } from '@/components/cards/PlaceTradeCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { History, DollarSign, Percent, BarChart2, Send, Combine, Bot, Lightbulb } from 'lucide-react'; // Added Lightbulb
import { getKeyMetrics } from '@/lib/firestoreService'; 
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
      {/* @ts-expect-error Server Component */}
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <AccountBalanceCard />
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

        <Tabs defaultValue="actions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 mb-4 bg-card border border-border shadow-sm">
            <TabsTrigger value="actions" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              <Send className="mr-2 h-5 w-5" /> Actions
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              <History className="mr-2 h-5 w-5" /> Trade History
            </TabsTrigger>
             <TabsTrigger value="strategyLab" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              <Bot className="mr-2 h-5 w-5" /> Bot & Strategy Hub
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actions">
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                <PlaceTradeCard />
                {/* @ts-expect-error Server Component */}
                <StrategyAssistantCard /> 
            </div>
          </TabsContent>
          <TabsContent value="history">
            {/* @ts-expect-error Server Component */}
            <TradeHistoryCard />
          </TabsContent>
          <TabsContent value="strategyLab">
            <div className="grid gap-4 md:grid-cols-1">
              {/* @ts-expect-error Server Component */}
              <StrategyDevelopmentCard />
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <footer className="py-4 px-8 text-center text-xs text-muted-foreground border-t border-border">
        TradeWatch Dashboard &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
    
