
'use client';

import { useState, useTransition } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { runBacktest, type BacktestInput, type BacktestOutput } from '@/ai/flows/backtest-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Loader2, LineChart, History, TableIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function BacktestingCard() {
  const [historicalDataCsv, setHistoricalDataCsv] = useState('');
  const [initialCapital, setInitialCapital] = useState('10000');
  const [tradeAmountUSD, setTradeAmountUSD] = useState('100'); // Changed from percentage
  const [targetSymbolOverride, setTargetSymbolOverride] = useState('');
  
  const [backtestResult, setBacktestResult] = useState<BacktestOutput | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBacktestResult(null);

    if (!historicalDataCsv.trim()) {
      setError('Please paste historical CSV data.');
      toast({ title: 'Input Missing', description: 'Historical data is required.', variant: 'destructive' });
      return;
    }
    const parsedCapital = parseFloat(initialCapital);
    const parsedTradeAmountUSD = parseFloat(tradeAmountUSD);

    if (isNaN(parsedCapital) || parsedCapital <= 0) {
      setError('Initial capital must be a positive number.');
      toast({ title: 'Input Error', description: 'Initial capital must be a positive number.', variant: 'destructive' });
      return;
    }
    if (isNaN(parsedTradeAmountUSD) || parsedTradeAmountUSD <= 0) {
      setError('Trade amount (USD) must be a positive number.');
      toast({ title: 'Input Error', description: 'Trade amount (USD) must be a positive number.', variant: 'destructive' });
      return;
    }

    const input: BacktestInput = {
      historicalDataCsv,
      initialCapital: parsedCapital,
      tradeAmountUSD: parsedTradeAmountUSD, // Using USD amount
      targetSymbolOverride: targetSymbolOverride.trim().toUpperCase() || undefined,
    };

    startTransition(async () => {
      try {
        const result = await runBacktest(input);
        if (result.errorMessage) {
          setError(result.errorMessage);
          toast({ title: 'Backtest Error', description: result.errorMessage, variant: 'destructive' });
          setBacktestResult(null);
        } else {
          setBacktestResult(result);
          toast({ title: 'Backtest Complete', description: `Simulated ${result.totalTrades} trades for ${result.symbolTested}.` });
        }
      } catch (err: any) {
        console.error('Error running backtest:', err);
        const errorMessage = err.message || 'Failed to run backtest due to an unexpected error.';
        setError(errorMessage);
        toast({ title: 'System Error', description: errorMessage, variant: 'destructive' });
        setBacktestResult(null);
      }
    });
  };
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center">
          <History className="mr-2 h-6 w-6 text-primary" />
          Strategy Backtester
        </CardTitle>
        <CardDescription>
          Test your current bot configuration against historical market data.
          Paste CSV data: `timestamp,open,high,low,close(,volume)`. Timestamp should be in milliseconds.
          The backtester uses the configuration saved in the "Bot & Strategy Hub".
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="historicalDataCsv">Historical Data (CSV format)</Label>
            <Textarea
              id="historicalDataCsv"
              value={historicalDataCsv}
              onChange={(e) => setHistoricalDataCsv(e.target.value)}
              placeholder="timestamp,open,high,low,close\n1672531200000,20000,20100,19900,20050\n1672534800000,20050,20150,20000,20100"
              className="mt-1 h-40 font-mono text-xs"
              disabled={isPending}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="initialCapital">Initial Capital ($)</Label>
              <Input id="initialCapital" type="number" value={initialCapital} onChange={(e) => setInitialCapital(e.target.value)} placeholder="e.g., 10000" disabled={isPending} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="tradeAmountUSD">Trade Amount (USD) per Backtest Trade</Label>
              <Input id="tradeAmountUSD" type="number" step="0.01" value={tradeAmountUSD} onChange={(e) => setTradeAmountUSD(e.target.value)} placeholder="e.g., 100" disabled={isPending} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="targetSymbolOverride">Target Symbol (Optional)</Label>
              <Input id="targetSymbolOverride" value={targetSymbolOverride} onChange={(e) => setTargetSymbolOverride(e.target.value.toUpperCase())} placeholder="e.g., BTCUSDT" disabled={isPending} className="mt-1" />
               <p className="text-xs text-muted-foreground mt-1">Overrides bot config's first symbol for this test.</p>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LineChart className="mr-2 h-4 w-4" />}
            Run Backtest
          </Button>
        </form>

        {backtestResult && (
          <div className="mt-8 space-y-6 p-4 border rounded-md bg-muted/20">
            <h3 className="text-xl font-semibold text-primary flex items-center"><CheckCircle className="mr-2 h-6 w-6 text-green-500"/>Backtest Results for {backtestResult.symbolTested}</h3>
            
            {backtestResult.configUsed && (
                <details className="text-xs bg-background p-3 rounded-md border">
                    <summary className="cursor-pointer font-medium">View Configuration Used</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-all">{JSON.stringify(backtestResult.configUsed, null, 2)}</pre>
                </details>
            )}

            <Separator />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
              <div><strong>Initial Capital:</strong> ${backtestResult.initialCapital.toLocaleString()}</div>
              <div><strong>Final Capital:</strong> ${backtestResult.finalCapital.toLocaleString()}</div>
              <div className={backtestResult.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}>
                <strong>Net Profit:</strong> ${backtestResult.netProfit.toLocaleString()} ({backtestResult.netProfitPercentage.toFixed(2)}%)
              </div>
              <hr className="col-span-full"/>
              <div><strong>Total Trades:</strong> {backtestResult.totalTrades}</div>
              <div><strong>Winning Trades:</strong> {backtestResult.winningTrades}</div>
              <div><strong>Losing Trades:</strong> {backtestResult.losingTrades}</div>
              <div><strong>Win Rate:</strong> {backtestResult.winRate.toFixed(2)}%</div>
              {backtestResult.averageWinAmount !== undefined && <div><strong>Avg. Win:</strong> ${backtestResult.averageWinAmount.toLocaleString()}</div>}
              {backtestResult.averageLossAmount !== undefined && <div><strong>Avg. Loss:</strong> ${backtestResult.averageLossAmount.toLocaleString()}</div>}
              {backtestResult.profitFactor !== undefined && <div><strong>Profit Factor:</strong> {backtestResult.profitFactor.toFixed(2)}</div>}
            </div>

            {backtestResult.simulatedTrades.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold text-lg mb-2 flex items-center"><TableIcon className="mr-2 h-5 w-5"/>Simulated Trades</h4>
                  <ScrollArea className="h-[300px] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Entry Time</TableHead>
                          <TableHead>Entry Price</TableHead>
                          <TableHead>Exit Time</TableHead>
                          <TableHead>Exit Price</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>PnL ($)</TableHead>
                          <TableHead>PnL (%)</TableHead>
                          <TableHead>Entry Reason</TableHead>
                          <TableHead>Exit Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {backtestResult.simulatedTrades.map((trade, index) => (
                          <TableRow key={index}>
                            <TableCell>{trade.symbol}</TableCell>
                            <TableCell>
                              <Badge variant={trade.type === 'BUY' ? 'default' : 'secondary'} 
                                     className={trade.type === 'BUY' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}>
                                {trade.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{formatTimestamp(trade.entryTimestamp)}</TableCell>
                            <TableCell>${trade.entryPrice.toFixed(2)}</TableCell>
                            <TableCell className="text-xs">{trade.exitTimestamp ? formatTimestamp(trade.exitTimestamp) : '-'}</TableCell>
                            <TableCell>{trade.exitPrice ? `$${trade.exitPrice.toFixed(2)}` : '-'}</TableCell>
                            <TableCell>{trade.quantity.toFixed(4)}</TableCell>
                            <TableCell className={trade.pnl && trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {trade.pnl !== undefined ? trade.pnl.toFixed(2) : '-'}
                            </TableCell>
                             <TableCell className={trade.pnlPercentage && trade.pnlPercentage >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {trade.pnlPercentage !== undefined ? `${trade.pnlPercentage.toFixed(2)}%` : '-'}
                            </TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate">{trade.reasonEntry}</TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate">{trade.reasonExit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </>
            )}
            {backtestResult.summary && (
              <>
                <Separator/>
                <div>
                    <h4 className="font-semibold text-lg mb-1">Performance Summary:</h4>
                    <p className="text-sm whitespace-pre-wrap">{backtestResult.summary}</p>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
