
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Keep for Type select
import { useToast } from '@/hooks/use-toast';
import { placeTrade, type PlaceTradeInput } from '@/ai/flows/trade-flow';
import { getAvailableSymbols } from '@/ai/flows/market-data-flow';
import type { AvailableSymbolsOutput } from '@/ai/flows/market-data-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Loader2, ChevronsUpDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

export function PlaceTradeCard() {
  const [symbol, setSymbol] = useState('');
  const [availableSymbols, setAvailableSymbols] = useState<AvailableSymbolsOutput>([]);
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(true);
  const [symbolError, setSymbolError] = useState<string | null>(null);
  const [openCombobox, setOpenCombobox] = useState(false);

  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchSymbols() {
      try {
        setIsLoadingSymbols(true);
        setSymbolError(null);
        const fetchedSymbols = await getAvailableSymbols();
        setAvailableSymbols(fetchedSymbols);
        // We don't auto-select a symbol anymore, user must pick from combobox
      } catch (err: any) {
        console.error("Error fetching symbols:", err);
        setSymbolError(err.message || "Failed to load symbols.");
        setAvailableSymbols([]);
      } finally {
        setIsLoadingSymbols(false);
      }
    }
    fetchSymbols();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setApiResponse(null);

    if (!symbol) {
      setApiResponse({ success: false, message: 'Please select a symbol.' });
      setIsLoading(false);
      toast({
        title: 'Validation Error',
        description: 'Please select a trading symbol.',
        variant: 'destructive',
      });
      return;
    }

    const tradeDetails: PlaceTradeInput = {
      symbol,
      type,
      quantity: parseFloat(quantity),
    };

    if (isNaN(tradeDetails.quantity) || tradeDetails.quantity <= 0) {
      setApiResponse({ success: false, message: 'Please enter a valid positive quantity.' });
      setIsLoading(false);
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid positive quantity.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await placeTrade(tradeDetails);
      setApiResponse(result);
      toast({
        title: result.success ? 'Trade Placed (Testnet)' : 'Trade Failed (Testnet)',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error: any) {
      console.error('Error placing trade:', error);
      const errorMessage = error.message || 'An unexpected error occurred.';
      setApiResponse({ success: false, message: errorMessage });
      toast({
        title: 'Trade Error (Testnet)',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getComboboxTriggerLabel = () => {
    if (isLoadingSymbols) return "Loading symbols...";
    if (symbolError) return "Error loading symbols";
    if (availableSymbols.length === 0 && !isLoadingSymbols && !symbolError) return "No symbols available";
    return symbol ? symbol : "Select symbol...";
  };

  return (
    <Card className="shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
      <CardHeader>
        <CardTitle>Place Test Trade (Testnet)</CardTitle>
        <CardDescription>Submit a market order on the Binance Futures Testnet.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="symbol-combobox">Symbol</Label>
            {symbolError && !isLoadingSymbols ? (
              <Alert variant="destructive" className="mt-1">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Symbol Loading Error</AlertTitle>
                <AlertDescription>{symbolError}</AlertDescription>
              </Alert>
            ) : (
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="w-full justify-between mt-1"
                    disabled={isLoadingSymbols || (availableSymbols.length === 0 && !symbolError) || isLoading}
                    id="symbol-combobox"
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
                              setSymbol(currentValue === symbol ? '' : currentValue.toUpperCase());
                              setOpenCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                symbol === s ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {s}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div>
            <Label htmlFor="type">Type</Label>
            <Select
              value={type}
              onValueChange={(value: 'BUY' | 'SELL') => setType(value)}
              disabled={isLoading}
            >
              <SelectTrigger id="type" className="mt-1">
                <SelectValue placeholder="Select trade type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BUY">BUY (Long)</SelectItem>
                <SelectItem value="SELL">SELL (Short)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g., 0.001 for BTC, 0.1 for ETH"
              step="any"
              disabled={isLoading}
              className="mt-1"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Note: Binance Testnet often requires a minimum order value of ~20 USDT (Quantity x Price).
            </p>
          </div>
          <Button type="submit" disabled={isLoading || isLoadingSymbols || !symbol} className="w-full">
            {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
            {isLoading ? 'Placing Trade...' : 'Place Test Trade'}
          </Button>
        </form>
        {apiResponse && (
          <Alert variant={apiResponse.success ? 'default' : 'destructive'} className="mt-4">
            {apiResponse.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <AlertTitle>{apiResponse.success ? 'Success' : 'Error'}</AlertTitle>
            <AlertDescription>{apiResponse.message}</AlertDescription>
          </Alert>
        )}
        <p className="mt-4 text-xs text-muted-foreground text-center">
          This interface interacts with the Binance Futures TESTNET. No real funds are used.
        </p>
      </CardContent>
    </Card>
  );
}
