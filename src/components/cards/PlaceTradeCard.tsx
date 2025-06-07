
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { placeTrade, type PlaceTradeInput } from '@/ai/flows/trade-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export function PlaceTradeCard() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setApiResponse(null);

    const tradeDetails: PlaceTradeInput = {
      symbol,
      type,
      quantity: parseFloat(quantity),
    };

    if (isNaN(tradeDetails.quantity) || tradeDetails.quantity <= 0) {
      setApiResponse({ success: false, message: 'Please enter a valid positive quantity.' });
      setIsLoading(false);
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

  return (
    <Card className="shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
      <CardHeader>
        <CardTitle>Place Test Trade (Testnet)</CardTitle>
        <CardDescription>Submit a market order on the Binance Futures Testnet.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="symbol">Symbol</Label>
            <Input
              id="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., BTCUSDT"
              disabled={isLoading}
              required
            />
          </div>
          <div>
            <Label htmlFor="type">Type</Label>
            <Select
              value={type}
              onValueChange={(value: 'BUY' | 'SELL') => setType(value)}
              disabled={isLoading}
            >
              <SelectTrigger id="type">
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
              placeholder="e.g., 0.001"
              step="any"
              disabled={isLoading}
              required
            />
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
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
