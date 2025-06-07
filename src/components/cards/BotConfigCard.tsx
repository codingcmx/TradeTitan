
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch'; // For boolean values
import { useToast } from '@/hooks/use-toast';
import type { BotConfig } from '@/types';
import { getBotConfiguration } from '@/lib/firestoreService';
import { saveBotConfigurationAction } from '@/app/actions';
import { Loader2, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

const initialFormState: BotConfig = {
  targetSymbols: [],
  emaShortPeriod: undefined,
  emaMediumPeriod: undefined,
  emaLongPeriod: undefined,
  atrPeriod: undefined,
  stopLossMultiplier: undefined,
  takeProfitMultiplier: undefined,
  tradingEnabled: false,
};


export function BotConfigCard() {
  const [config, setConfig] = useState<BotConfig>(initialFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchConfig() {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedConfig = await getBotConfiguration();
        setConfig({
          ...initialFormState, // Start with defaults
          ...fetchedConfig, // Override with fetched values
          // Ensure targetSymbols is a string for the input, join if it's an array
          targetSymbols: Array.isArray(fetchedConfig.targetSymbols) ? fetchedConfig.targetSymbols.join(', ') : '',
        });
      } catch (err: any) {
        console.error("Error fetching bot config:", err);
        setError(err.message || "Failed to load configuration.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? (value === '' ? undefined : parseFloat(value)) : value,
    }));
  };
  
  const handleSwitchChange = (checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      tradingEnabled: checked,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      const formData = new FormData(event.currentTarget);
      const result = await saveBotConfigurationAction(formData);
      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        if (result.updatedConfig) {
           setConfig({
            ...initialFormState,
            ...result.updatedConfig,
            targetSymbols: Array.isArray(result.updatedConfig.targetSymbols) ? result.updatedConfig.targetSymbols.join(', ') : '',
          });
        }
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
        setError(result.message);
      }
    });
  };
  
  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>Bot Configuration</CardTitle>
          <CardDescription>Adjust settings for the trading bot.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Label className="block h-4 w-1/4 bg-muted rounded animate-pulse"></Label>
              <Input className="h-10 bg-muted rounded animate-pulse" disabled />
            </div>
          ))}
          <Button disabled className="w-full">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </Button>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Bot Configuration</CardTitle>
        <CardDescription>Adjust settings for the trading bot. Changes are saved to Firestore.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-auto pr-2">
         {error && !isPending && ( // Show general fetch error if not related to submission
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Loading Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="tradingEnabled" className="flex items-center justify-between">
              <span>Trading Enabled</span>
              <Switch
                id="tradingEnabled"
                name="tradingEnabled"
                checked={config.tradingEnabled || false}
                onCheckedChange={handleSwitchChange}
                disabled={isPending}
              />
            </Label>
            <p className="text-xs text-muted-foreground mt-1">Enable or disable all trading activity.</p>
          </div>

          <div>
            <Label htmlFor="targetSymbols">Target Symbols (comma-separated)</Label>
            <Input
              id="targetSymbols"
              name="targetSymbols"
              value={config.targetSymbols || ''}
              onChange={handleInputChange}
              placeholder="e.g., BTCUSDT, ETHUSDT"
              disabled={isPending}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Symbols the bot will monitor and trade.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="emaShortPeriod">EMA Short Period</Label>
              <Input
                id="emaShortPeriod"
                name="emaShortPeriod"
                type="number"
                value={config.emaShortPeriod === undefined ? '' : config.emaShortPeriod}
                onChange={handleInputChange}
                placeholder="e.g., 9"
                disabled={isPending}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="emaMediumPeriod">EMA Medium Period</Label>
              <Input
                id="emaMediumPeriod"
                name="emaMediumPeriod"
                type="number"
                value={config.emaMediumPeriod === undefined ? '' : config.emaMediumPeriod}
                onChange={handleInputChange}
                placeholder="e.g., 21"
                disabled={isPending}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="emaLongPeriod">EMA Long Period</Label>
              <Input
                id="emaLongPeriod"
                name="emaLongPeriod"
                type="number"
                value={config.emaLongPeriod === undefined ? '' : config.emaLongPeriod}
                onChange={handleInputChange}
                placeholder="e.g., 55"
                disabled={isPending}
                className="mt-1"
              />
            </div>
          </div>
           <p className="text-xs text-muted-foreground -mt-3">Periods for Exponential Moving Averages.</p>


          <div>
            <Label htmlFor="atrPeriod">ATR Period</Label>
            <Input
              id="atrPeriod"
              name="atrPeriod"
              type="number"
              value={config.atrPeriod === undefined ? '' : config.atrPeriod}
              onChange={handleInputChange}
              placeholder="e.g., 14"
              disabled={isPending}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Period for Average True Range (ATR) calculation.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="stopLossMultiplier">Stop Loss Multiplier (ATR-based)</Label>
              <Input
                id="stopLossMultiplier"
                name="stopLossMultiplier"
                type="number"
                step="0.1"
                value={config.stopLossMultiplier === undefined ? '' : config.stopLossMultiplier}
                onChange={handleInputChange}
                placeholder="e.g., 1.5"
                disabled={isPending}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="takeProfitMultiplier">Take Profit Multiplier (ATR-based)</Label>
              <Input
                id="takeProfitMultiplier"
                name="takeProfitMultiplier"
                type="number"
                step="0.1"
                value={config.takeProfitMultiplier === undefined ? '' : config.takeProfitMultiplier}
                onChange={handleInputChange}
                placeholder="e.g., 3"
                disabled={isPending}
                className="mt-1"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-3">Multipliers for ATR to set stop-loss/take-profit.</p>
          
          <Button type="submit" disabled={isPending || isLoading} className="w-full mt-6">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Configuration
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
