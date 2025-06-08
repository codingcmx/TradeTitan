
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, Check, LineChart as ChartIcon, AlertTriangle, Loader2 } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  ReferenceDot,
} from 'recharts';
import { getHistoricalCandles, type HistoricalCandlesInput, type HistoricalCandlesOutput } from '@/ai/flows/market-data-flow';
import { getAvailableSymbols, type AvailableSymbolsOutput } from '@/ai/flows/market-data-flow';
import { getTradeHistory, type Trade } from '@/lib/firestoreService';
import type { Candlestick } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const availableTimeframes = [
  { value: '1m', label: '1 Minute' }, { value: '3m', label: '3 Minutes' }, { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' }, { value: '30m', label: '30 Minutes' }, { value: '1h', label: '1 Hour' },
  { value: '2h', label: '2 Hours' }, { value: '4h', label: '4 Hours' }, { value: '6h', label: '6 Hours' },
  { value: '8h', label: '8 Hours' }, { value: '12h', label: '12 Hours' }, { value: '1d', label: '1 Day' },
];

const MAX_CANDLES = 500; 
const REFRESH_INTERVAL_MS = 1 * 60 * 1000; // Refresh every 1 minute

export function TradeExecutionChart() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1h');
  const [candleLimit, setCandleLimit] = useState<number>(100);

  const [availableSymbols, setAvailableSymbols] = useState<AvailableSymbolsOutput>([]);
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(true);
  const [symbolError, setSymbolError] = useState<string | null>(null);
  const [openCombobox, setOpenCombobox] = useState(false);

  const [chartData, setChartData] = useState<Candlestick[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [isLoadingChartData, setIsLoadingChartData] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    async function fetchSymbols() {
      setIsLoadingSymbols(true);
      setSymbolError(null);
      try {
        const fetchedSymbols = await getAvailableSymbols();
        setAvailableSymbols(fetchedSymbols);
        // No auto-selection, user picks
      } catch (err: any) {
        setSymbolError(err.message || "Failed to load symbols.");
      } finally {
        setIsLoadingSymbols(false);
      }
    }
    fetchSymbols();
  }, []);

  const loadChartData = useCallback(async (isInitialLoad = false) => {
    if (!selectedSymbol || !selectedTimeframe) {
      setChartData([]);
      setTradeHistory([]);
      return;
    }
    if (isInitialLoad) setIsLoadingChartData(true); // Only show full loader on initial symbol/timeframe change
    setChartError(null);
    try {
      const candleInput: HistoricalCandlesInput = {
        symbol: selectedSymbol,
        interval: selectedTimeframe,
        limit: candleLimit > MAX_CANDLES ? MAX_CANDLES : candleLimit,
      };
      const [candles, trades] = await Promise.all([
        getHistoricalCandles(candleInput),
        getTradeHistory(200) 
      ]);
      
      setChartData(candles.sort((a,b) => a.timestamp - b.timestamp));
      
      const firstCandleTime = candles[0]?.timestamp;
      const lastCandleTime = candles[candles.length - 1]?.timestamp;

      const relevantTrades = trades.filter(trade => 
          trade.symbol === selectedSymbol &&
          trade.timestampOpen &&
          firstCandleTime && lastCandleTime &&
          (
              (trade.timestampOpen.getTime() >= firstCandleTime && trade.timestampOpen.getTime() <= lastCandleTime) ||
              (trade.timestampClose && trade.timestampClose.getTime() >= firstCandleTime && trade.timestampClose.getTime() <= lastCandleTime) ||
              (trade.timestampOpen.getTime() < firstCandleTime && trade.timestampClose && trade.timestampClose.getTime() > firstCandleTime) 
          )
      );
      setTradeHistory(relevantTrades);

    } catch (err: any) {
      const errorMessage = err.message || "Failed to load chart data.";
      setChartError(errorMessage);
      if(isInitialLoad) { // Only toast on initial load errors
        toast({ title: "Chart Error", description: errorMessage, variant: "destructive" });
      }
      setChartData([]);
      setTradeHistory([]);
    } finally {
      if (isInitialLoad) setIsLoadingChartData(false);
    }
  }, [selectedSymbol, selectedTimeframe, candleLimit, toast]);

  useEffect(() => {
    loadChartData(true); // Initial load
  }, [loadChartData]);

  useEffect(() => {
    if (!selectedSymbol || !selectedTimeframe) return;

    const intervalId = setInterval(() => {
      // console.log('Refreshing chart data...'); // For debugging
      loadChartData(false); // Subsequent loads are not "initial"
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId); // Cleanup interval on component unmount or when dependencies change
  }, [selectedSymbol, selectedTimeframe, loadChartData]); // loadChartData is now a dependency

  
  const formattedChartData = useMemo(() => {
    return chartData.map(candle => ({
      time: candle.timestamp,
      displayTime: new Date(candle.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      close: candle.close,
    }));
  }, [chartData]);


  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background/80 backdrop-blur-sm p-3 border border-border rounded-md shadow-lg text-xs">
          <p className="font-semibold text-foreground">{new Date(data.time).toLocaleString()}</p>
          <p className="text-primary">Close: <span className="font-mono">${data.close.toFixed(2)}</span></p>
        </div>
      );
    }
    return null;
  };

  const getComboboxTriggerLabel = () => {
    if (isLoadingSymbols) return "Loading symbols...";
    if (symbolError) return "Error loading symbols";
    if (availableSymbols.length === 0 && !isLoadingSymbols && !symbolError) return "No symbols";
    return selectedSymbol ? selectedSymbol : "Select symbol...";
  };

  return (
    <Card className="shadow-lg col-span-1 md:col-span-2 lg:col-span-3">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
                <CardTitle className="flex items-center">
                <ChartIcon className="mr-2 h-6 w-6 text-primary" />
                Trade Execution Chart
                </CardTitle>
                <CardDescription>Visualize price action and your bot's trades. Refreshes automatically.</CardDescription>
            </div>
             <div className="flex flex-col sm:flex-row gap-2 items-center w-full sm:w-auto">
                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                    <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCombobox}
                        className="w-full sm:w-[180px] justify-between"
                        disabled={isLoadingSymbols || availableSymbols.length === 0 || isLoadingChartData}
                    >
                        {getComboboxTriggerLabel()}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder="Search symbol..." />
                        <CommandList>
                        <CommandEmpty>No symbol found.</CommandEmpty>
                        <CommandGroup>
                            {availableSymbols.map((s) => (
                            <CommandItem
                                key={s}
                                value={s}
                                onSelect={(currentValue) => {
                                setSelectedSymbol(currentValue === selectedSymbol ? '' : currentValue.toUpperCase());
                                setOpenCombobox(false);
                                }}
                            >
                                <Check className={cn("mr-2 h-4 w-4", selectedSymbol === s ? "opacity-100" : "opacity-0")} />
                                {s}
                            </CommandItem>
                            ))}
                        </CommandGroup>
                        </CommandList>
                    </Command>
                    </PopoverContent>
                </Popover>

                <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe} disabled={isLoadingChartData}>
                    <SelectTrigger className="w-full sm:w-[130px]">
                    <SelectValue placeholder="Timeframe" />
                    </SelectTrigger>
                    <SelectContent>
                    {availableTimeframes.map(tf => (
                        <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
         {symbolError && (
          <Alert variant="destructive" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Symbol Loading Error</AlertTitle>
            <AlertDescription>{symbolError}</AlertDescription>
          </Alert>
        )}
      </CardHeader>
      <CardContent className="pt-2">
        {chartError && !isLoadingChartData && (
           <Alert variant="destructive" className="my-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Chart Data Error</AlertTitle>
            <AlertDescription>{chartError}</AlertDescription>
          </Alert>
        )}
        {isLoadingChartData && (
            <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p>Loading chart data for {selectedSymbol} ({selectedTimeframe})...</p>
            </div>
        )}
        {!isLoadingChartData && !chartError && formattedChartData.length === 0 && selectedSymbol && (
             <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
                <ChartIcon className="h-12 w-12 mb-4" />
                <p>No chart data available for {selectedSymbol} ({selectedTimeframe}).</p>
                <p className="text-xs">Try selecting a symbol and timeframe, or ensure data exists for the selection.</p>
            </div>
        )}
        {!isLoadingChartData && !chartError && formattedChartData.length > 0 && (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={formattedChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="displayTime" 
                stroke="hsl(var(--muted-foreground))" 
                tick={{ fontSize: 12 }} 
                />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                tick={{ fontSize: 12 }} 
                domain={['auto', 'auto']} 
                tickFormatter={(value) => `$${value.toFixed(Math.max(0, 8 - Math.floor(Math.log10(Math.abs(value)))))}`} 
                />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="close" name="Close Price" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              
              {tradeHistory.map(trade => (
                <ReferenceDot
                    key={`entry-${trade.id}`}
                    x={new Date(trade.timestampOpen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    y={trade.entryPrice}
                    r={5}
                    fill={trade.type === 'BUY' ? 'var(--chart-2)' : 'var(--chart-5)'} 
                    stroke="hsl(var(--background))"
                    ifOverflow="extendDomain"
                 >
                   <title>{`${trade.type} Entry @ ${trade.entryPrice}`}</title>
                 </ReferenceDot>
              ))}
               {tradeHistory.filter(t => t.exitPrice && t.timestampClose).map(trade => (
                 <ReferenceDot
                    key={`exit-${trade.id}`}
                    x={new Date(trade.timestampClose!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    y={trade.exitPrice!}
                    r={5}
                    fill={trade.type === 'BUY' ? 'var(--chart-5)' : 'var(--chart-2)'} 
                    stroke="hsl(var(--background))"
                    ifOverflow="extendDomain"
                 >
                   <title>{`Exit @ ${trade.exitPrice}`}</title>
                 </ReferenceDot>
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
         {!isLoadingChartData && !chartError && !selectedSymbol && (
             <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
                <ChartIcon className="h-12 w-12 mb-4" />
                <p>Please select a symbol and timeframe to display the chart.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}

    