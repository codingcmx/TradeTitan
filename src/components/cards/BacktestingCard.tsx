
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
import { AlertTriangle, CheckCircle, Loader2, LineChart, History, TableIcon, SlidersHorizontal } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const availableTimeframes = [
  { value: '1m', label: '1 Minute' }, { value: '3m', label: '3 Minutes' }, { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' }, { value: '30m', label: '30 Minutes' }, { value: '1h', label: '1 Hour' },
  { value: '2h', label: '2 Hours' }, { value: '4h', label: '4 Hours' }, { value: '6h', label: '6 Hours' },
  { value: '8h', label: '8 Hours' }, { value: '12h', label: '12 Hours' }, { value: '1d', label: '1 Day' },
  { value: '3d', label: '3 Days' }, { value: '1w', label: '1 Week' },
];

export function BacktestingCard() {
  const [historicalDataCsv, setHistoricalDataCsv] = useState('');
  const [initialCapital, setInitialCapital] = useState('10000');
  const [tradeAmountUSD, setTradeAmountUSD] = useState('100');
  
  // States for override parameters
  const [overrideTargetSymbol, setOverrideTargetSymbol] = useState('');
  const [overrideTimeframe, setOverrideTimeframe] = useState('');
  const [overrideEmaShort, setOverrideEmaShort] = useState('');
  const [overrideEmaMedium, setOverrideEmaMedium] = useState('');
  const [overrideAtrPeriod, setOverrideAtrPeriod] = useState('');
  const [overrideStopLossMultiplier, setOverrideStopLossMultiplier] = useState('');
  const [overrideTakeProfitMultiplier, setOverrideTakeProfitMultiplier] = useState('');
  
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
      tradeAmountUSD: parsedTradeAmountUSD,
      targetSymbolOverride: overrideTargetSymbol.trim().toUpperCase() || undefined,
      emaShortPeriod: overrideEmaShort ? parseInt(overrideEmaShort, 10) : undefined,
      emaMediumPeriod: overrideEmaMedium ? parseInt(overrideEmaMedium, 10) : undefined,
      atrPeriod: overrideAtrPeriod ? parseInt(overrideAtrPeriod, 10) : undefined,
      stopLossMultiplier: overrideStopLossMultiplier ? parseFloat(overrideStopLossMultiplier) : undefined,
      takeProfitMultiplier: overrideTakeProfitMultiplier ? parseFloat(overrideTakeProfitMultiplier) : undefined,
      timeframe: overrideTimeframe || undefined,
    };

    // Validate that if one override param is set, all necessary ones are set
    const overrideParamsSet = [input.emaShortPeriod, input.emaMediumPeriod, input.atrPeriod, input.stopLossMultiplier, input.takeProfitMultiplier, input.timeframe];
    const someOverridesSet = overrideParamsSet.some(p => p !== undefined);
    const allRequiredOverridesSet = input.emaShortPeriod !== undefined && input.emaMediumPeriod !== undefined && input.atrPeriod !== undefined && input.stopLossMultiplier !== undefined && input.takeProfitMultiplier !== undefined && input.timeframe !== undefined;

    if (someOverridesSet && !allRequiredOverridesSet) {
        setError("If overriding strategy parameters, please fill all: EMA Short, EMA Medium, ATR Period, SL Multiplier, TP Multiplier, and Timeframe.");
        toast({ title: 'Input Error', description: "Missing some override parameters. Please fill all or none.", variant: 'destructive' });
        return;
    }


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
          Test a strategy against historical market data. Uses EMA Crossover (Short/Medium) for entry and ATR-based Stop Loss/Take Profit.
          Paste CSV data: `timestamp,open,high,low,close(,volume)`. Timestamp should be in milliseconds.
          Default parameters are from "Bot & Strategy Hub", or override them below.
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="initialCapital">Initial Capital ($)</Label>
              <Input id="initialCapital" type="number" value={initialCapital} onChange={(e) => setInitialCapital(e.target.value)} placeholder="e.g., 10000" disabled={isPending} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="tradeAmountUSD">Trade Amount (USD) per Backtest Trade</Label>
              <Input id="tradeAmountUSD" type="number" step="0.01" value={tradeAmountUSD} onChange={(e) => setTradeAmountUSD(e.target.value)} placeholder="e.g., 100" disabled={isPending} className="mt-1" />
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-sm hover:no-underline">
                <div className="flex items-center">
                 <SlidersHorizontal className="mr-2 h-4 w-4"/> Override Strategy Parameters (Optional)
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <p className="text-xs text-muted-foreground">If you fill these, they will be used for this backtest run instead of the globally saved bot configuration. All fields in this section must be filled if any one is.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="overrideTargetSymbol">Target Symbol Override</Label>
                        <Input id="overrideTargetSymbol" value={overrideTargetSymbol} onChange={(e) => setOverrideTargetSymbol(e.target.value.toUpperCase())} placeholder="e.g., BTCUSDT" disabled={isPending} className="mt-1" />
                        <p className="text-xs text-muted-foreground mt-1">Overrides bot config's symbol AND CSV header symbol for this test.</p>
                    </div>
                    <div>
                        <Label htmlFor="overrideTimeframe">Trading Timeframe Override</Label>
                        <Select value={overrideTimeframe} onValueChange={setOverrideTimeframe} disabled={isPending}>
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select timeframe..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableTimeframes.map(tf => (
                                    <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="overrideEmaShort">EMA Short Period Override</Label>
                        <Input id="overrideEmaShort" type="number" value={overrideEmaShort} onChange={(e) => setOverrideEmaShort(e.target.value)} placeholder="e.g., 9" disabled={isPending} className="mt-1" />
                    </div>
                    <div>
                        <Label htmlFor="overrideEmaMedium">EMA Medium Period Override</Label>
                        <Input id="overrideEmaMedium" type="number" value={overrideEmaMedium} onChange={(e) => setOverrideEmaMedium(e.target.value)} placeholder="e.g., 21" disabled={isPending} className="mt-1" />
                    </div>
                </div>
                <div>
                    <Label htmlFor="overrideAtrPeriod">ATR Period Override</Label>
                    <Input id="overrideAtrPeriod" type="number" value={overrideAtrPeriod} onChange={(e) => setOverrideAtrPeriod(e.target.value)} placeholder="e.g., 14" disabled={isPending} className="mt-1" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="overrideStopLossMultiplier">Stop Loss Multiplier Override</Label>
                        <Input id="overrideStopLossMultiplier" type="number" step="0.1" value={overrideStopLossMultiplier} onChange={(e) => setOverrideStopLossMultiplier(e.target.value)} placeholder="e.g., 1.5" disabled={isPending} className="mt-1" />
                    </div>
                    <div>
                        <Label htmlFor="overrideTakeProfitMultiplier">Take Profit Multiplier Override</Label>
                        <Input id="overrideTakeProfitMultiplier" type="number" step="0.1" value={overrideTakeProfitMultiplier} onChange={(e) => setOverrideTakeProfitMultiplier(e.target.value)} placeholder="e.g., 3" disabled={isPending} className="mt-1" />
                    </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>


          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isPending} className="w-full mt-6">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LineChart className="mr-2 h-4 w-4" />}
            Run Backtest
          </Button>
        </form>

        {backtestResult && (
          <div className="mt-8 space-y-6 p-4 border rounded-md bg-muted/20">
            <h3 className="text-xl font-semibold text-primary flex items-center"><CheckCircle className="mr-2 h-6 w-6 text-green-500"/>Backtest Results for {backtestResult.symbolTested}</h3>
            
            {backtestResult.configUsed && (
                <details className="text-xs bg-background p-3 rounded-md border">
                    <summary className="cursor-pointer font-medium">
                        {backtestResult.configUsed.type === 'override' ? 'Override Parameters Used for this Backtest:' : 'Global Bot Configuration Used:'}
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap break-all">{JSON.stringify(backtestResult.configUsed.params, null, 2)}</pre>
                </details>
            )}

            <Separator />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
              <div><strong>Initial Capital:</strong> ${backtestResult.initialCapital.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
              <div><strong>Final Capital:</strong> ${backtestResult.finalCapital.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
              <div className={backtestResult.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}>
                <strong>Net Profit:</strong> ${backtestResult.netProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ({backtestResult.netProfitPercentage.toFixed(2)}%)
              </div>
              <hr className="col-span-full"/>
              <div><strong>Total Trades:</strong> {backtestResult.totalTrades}</div>
              <div><strong>Winning Trades:</strong> {backtestResult.winningTrades}</div>
              <div><strong>Losing Trades:</strong> {backtestResult.losingTrades}</div>
              <div><strong>Win Rate:</strong> {backtestResult.winRate.toFixed(2)}%</div>
              {backtestResult.averageWinAmount !== undefined && <div><strong>Avg. Win:</strong> ${backtestResult.averageWinAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>}
              {backtestResult.averageLossAmount !== undefined && <div><strong>Avg. Loss:</strong> ${backtestResult.averageLossAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>}
              {backtestResult.profitFactor !== undefined && <div><strong>Profit Factor:</strong> {isFinite(backtestResult.profitFactor) ? backtestResult.profitFactor.toFixed(2) : 'Infinity'}</div>}
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
                          <TableHead className="max-w-[200px]">Entry Reason</TableHead>
                          <TableHead  className="max-w-[200px]">Exit Reason</TableHead>
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
                            <TableCell>${trade.entryPrice.toFixed(4)}</TableCell>
                            <TableCell className="text-xs">{trade.exitTimestamp ? formatTimestamp(trade.exitTimestamp) : '-'}</TableCell>
                            <TableCell>{trade.exitPrice ? `$${trade.exitPrice.toFixed(4)}` : '-'}</TableCell>
                            <TableCell>{trade.quantity.toFixed(6)}</TableCell>
                            <TableCell className={trade.pnl && trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {trade.pnl !== undefined ? trade.pnl.toFixed(4) : '-'}
                            </TableCell>
                             <TableCell className={trade.pnlPercentage && trade.pnlPercentage >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {trade.pnlPercentage !== undefined ? `${trade.pnlPercentage.toFixed(2)}%` : '-'}
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate" title={trade.reasonEntry}>{trade.reasonEntry}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate" title={trade.reasonExit}>{trade.reasonExit}</TableCell>
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
