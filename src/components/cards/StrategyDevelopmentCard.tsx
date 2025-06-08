
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { CustomStrategyDoc, BotConfig } from '@/types';
import { getCustomStrategyDoc, getBotConfiguration } from '@/lib/firestoreService';
import { validateStrategyConsistency, type StrategyValidationOutput } from '@/ai/flows/strategy-validator-flow';
import { saveStrategyAndConfigurationAction } from '@/app/actions';
import { Loader2, Save, FileText, Wand2, AlertTriangle, CheckCircle2, Bot as BotIcon, Info, Power, Clock, DollarSign } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface StrategyFormData extends CustomStrategyDoc {
  capital: string;
  targetSymbols: string;
  emaShortPeriod?: number | string;
  emaMediumPeriod?: number | string;
  emaLongPeriod?: number | string;
  atrPeriod?: number | string;
  stopLossMultiplier?: number | string;
  takeProfitMultiplier?: number | string;
  tradingEnabled: boolean;
  timeframe?: string;
  tradeAmountUSD?: number | string;
}

const initialFormState: StrategyFormData = {
  pineScript: '',
  explanation: '',
  capital: '1000',
  targetSymbols: '',
  emaShortPeriod: '',
  emaMediumPeriod: '',
  emaLongPeriod: '',
  atrPeriod: '',
  stopLossMultiplier: '',
  takeProfitMultiplier: '',
  tradingEnabled: false,
  timeframe: '1h',
  tradeAmountUSD: '',
};

const availableTimeframes = [
  { value: '1m', label: '1 Minute' },
  { value: '3m', label: '3 Minutes' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '30m', label: '30 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '2h', label: '2 Hours' },
  { value: '4h', label: '4 Hours' },
  { value: '6h', label: '6 Hours' },
  { value: '8h', label: '8 Hours' },
  { value: '12h', label: '12 Hours' },
  { value: '1d', label: '1 Day' },
  { value: '3d', label: '3 Days' },
  { value: '1w', label: '1 Week' },
];


export function StrategyDevelopmentCard() {
  const [formData, setFormData] = useState<StrategyFormData>(initialFormState);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const [isSaving, startSaveTransition] = useTransition();
  const [isValidating, startValidationTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<StrategyValidationOutput | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchInitialData() {
      setIsLoadingInitialData(true);
      setError(null);
      try {
        const [doc, config] = await Promise.all([
          getCustomStrategyDoc(),
          getBotConfiguration()
        ]);

        setFormData(prev => ({
          ...prev,
          pineScript: doc.pineScript || '',
          explanation: doc.explanation || '',
          capital: config?.capital?.toString() || prev.capital || initialFormState.capital,
          targetSymbols: Array.isArray(config.targetSymbols) ? config.targetSymbols.join(', ') : (config.targetSymbols || ''),
          emaShortPeriod: config.emaShortPeriod?.toString() || '',
          emaMediumPeriod: config.emaMediumPeriod?.toString() || '',
          emaLongPeriod: config.emaLongPeriod?.toString() || '',
          atrPeriod: config.atrPeriod?.toString() || '',
          stopLossMultiplier: config.stopLossMultiplier?.toString() || '',
          takeProfitMultiplier: config.takeProfitMultiplier?.toString() || '',
          tradingEnabled: config.tradingEnabled || false,
          timeframe: config.timeframe || initialFormState.timeframe,
          tradeAmountUSD: config.tradeAmountUSD?.toString() || '',
        }));

      } catch (err: any) {
        console.error("Error fetching initial strategy data:", err);
        const msg = err.message || "Failed to load initial strategy data.";
        setError(msg);
        toast({ title: "Loading Error", description: "Could not load existing strategy data.", variant: "destructive" });
      } finally {
        setIsLoadingInitialData(false);
      }
    }
    fetchInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'pineScript' || name === 'explanation') {
        setValidationResult(null);
    }
    setError(null);
  };

  const handleSwitchChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, tradingEnabled: checked }));
    setError(null);
  };

  const handleTimeframeChange = (value: string) => {
    setFormData(prev => ({ ...prev, timeframe: value }));
    setError(null);
  };

  const handleValidate = async () => {
    setError(null);
    setValidationResult(null);
    if (!formData.pineScript?.trim() && !formData.explanation?.trim()) {
      setError("Please provide both Pine Script and an explanation before validating.");
      toast({ title: 'Input Missing', description: "Pine Script and explanation are required for validation.", variant: 'destructive' });
      return;
    }
    startValidationTransition(async () => {
      try {
        const result = await validateStrategyConsistency({
          pineScript: formData.pineScript || '',
          explanation: formData.explanation || '',
        });
        setValidationResult(result);
        toast({
            title: result.isConsistent ? "Validation: Consistent" : "Validation: Mismatches Found",
            description: result.isConsistent ? "Strategy and explanation appear consistent." : "Review feedback for mismatches.",
            variant: result.isConsistent ? "default" : "destructive"
        });
      } catch (err: any) {
        console.error("Error validating strategy:", err);
        const msg = err.message || "Failed to validate strategy with AI.";
        setError(msg);
        toast({ title: 'Validation AI Error', description: msg, variant: 'destructive' });
      }
    });
  };

  const checkRequiredFields = useCallback(() : boolean => {
    if (!formData.targetSymbols?.trim()) return false;
    if (formData.atrPeriod === '' || isNaN(Number(formData.atrPeriod))) return false;
    if (formData.stopLossMultiplier === '' || isNaN(Number(formData.stopLossMultiplier))) return false;
    if (formData.takeProfitMultiplier === '' || isNaN(Number(formData.takeProfitMultiplier))) return false;
    if (formData.tradeAmountUSD === '' || isNaN(Number(formData.tradeAmountUSD)) || Number(formData.tradeAmountUSD) <= 0) return false;
    if (!formData.timeframe) return false;
    return true;
  }, [formData]);

  const handleSaveStrategyAndConfig = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parsedCapital = parseFloat(formData.capital);
    if (isNaN(parsedCapital) || parsedCapital <= 0) {
        setError("Capital must be a positive number.");
        toast({ title: "Input Error", description: "Capital must be a positive number.", variant: "destructive" });
        return;
    }

    if (formData.tradingEnabled && !checkRequiredFields()) {
        setError("Cannot enable trading. Please ensure Target Symbols, Timeframe, Trade Amount (USD), ATR Period, Stop Loss Multiplier, and Take Profit Multiplier are filled correctly.");
        toast({ title: "Configuration Incomplete", description: "Required fields are missing to enable trading.", variant: "destructive"});
        return;
    }

    const configToSave: BotConfig = {
      targetSymbols: formData.targetSymbols.split(',').map(s => s.trim()).filter(Boolean),
      emaShortPeriod: formData.emaShortPeriod !== '' && !isNaN(Number(formData.emaShortPeriod)) ? Number(formData.emaShortPeriod) : undefined,
      emaMediumPeriod: formData.emaMediumPeriod !== '' && !isNaN(Number(formData.emaMediumPeriod)) ? Number(formData.emaMediumPeriod) : undefined,
      emaLongPeriod: formData.emaLongPeriod !== '' && !isNaN(Number(formData.emaLongPeriod)) ? Number(formData.emaLongPeriod) : undefined,
      atrPeriod: formData.atrPeriod !== '' && !isNaN(Number(formData.atrPeriod)) ? Number(formData.atrPeriod) : undefined,
      stopLossMultiplier: formData.stopLossMultiplier !== '' && !isNaN(Number(formData.stopLossMultiplier)) ? Number(formData.stopLossMultiplier) : undefined,
      takeProfitMultiplier: formData.takeProfitMultiplier !== '' && !isNaN(Number(formData.takeProfitMultiplier)) ? Number(formData.takeProfitMultiplier) : undefined,
      tradingEnabled: formData.tradingEnabled,
      capital: parsedCapital,
      timeframe: formData.timeframe,
      tradeAmountUSD: formData.tradeAmountUSD !== '' && !isNaN(Number(formData.tradeAmountUSD)) ? Number(formData.tradeAmountUSD) : undefined,
    };

    startSaveTransition(async () => {
      const result = await saveStrategyAndConfigurationAction({
        pineScript: formData.pineScript || '',
        explanation: formData.explanation || '',
        configToSave,
      });

      if (result.success) {
        toast({ title: 'Success', description: "Strategy and bot configuration saved! Bot status in header should update shortly." });
        const updatedConfig = await getBotConfiguration();
        setFormData(prev => ({
            ...prev,
            pineScript: formData.pineScript || '', // keep current script/explanation
            explanation: formData.explanation || '',
            tradingEnabled: updatedConfig.tradingEnabled || false,
            targetSymbols: Array.isArray(updatedConfig.targetSymbols) ? updatedConfig.targetSymbols.join(', ') : (updatedConfig.targetSymbols || ''),
            emaShortPeriod: updatedConfig.emaShortPeriod?.toString() || '',
            emaMediumPeriod: updatedConfig.emaMediumPeriod?.toString() || '',
            emaLongPeriod: updatedConfig.emaLongPeriod?.toString() || '',
            atrPeriod: updatedConfig.atrPeriod?.toString() || '',
            stopLossMultiplier: updatedConfig.stopLossMultiplier?.toString() || '',
            takeProfitMultiplier: updatedConfig.takeProfitMultiplier?.toString() || '',
            capital: updatedConfig.capital?.toString() || prev.capital,
            timeframe: updatedConfig.timeframe || initialFormState.timeframe,
            tradeAmountUSD: updatedConfig.tradeAmountUSD?.toString() || '',
        }));
      } else {
        toast({ title: 'Error Saving', description: result.message || 'An unknown error occurred during save.', variant: 'destructive' });
        setError(result.message || 'Failed to save.');
      }
    });
  };

  useEffect(() => {
    // This effect is to re-check required fields if tradingEnabled is toggled ON
    // and provide immediate feedback if something is missing.
    if (formData.tradingEnabled && !checkRequiredFields()) {
      setError("Required fields (*) must be filled to enable trading.");
    } else if (error === "Required fields (*) must be filled to enable trading.") {
      // Clear the specific error if fields are now filled
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.tradingEnabled, checkRequiredFields]);


  if (isLoadingInitialData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><BotIcon className="mr-2 h-6 w-6 text-primary" /> Bot & Strategy Hub</CardTitle>
          <CardDescription>Define, validate, and configure your trading strategy.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex flex-col items-center justify-center h-64">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="text-center text-muted-foreground">Loading strategy data...</p>
        </CardContent>
      </Card>
    );
  }

  const isSaveDisabled = isSaving || isValidating || isLoadingInitialData;
  const areRequiredFieldsMissingForActivation = formData.tradingEnabled && !checkRequiredFields();


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><BotIcon className="mr-2 h-6 w-6 text-primary" /> Bot & Strategy Hub</CardTitle>
        <CardDescription>
          Define your strategy, validate consistency with AI, then configure and activate your backend bot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(error && !isSaving) && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSaveStrategyAndConfig} className="space-y-8">

          {/* Section 1: Define Strategy */}
          <section className="space-y-4 p-6 border rounded-lg shadow-sm bg-card">
            <h3 className="text-xl font-semibold flex items-center text-primary"><FileText className="mr-2 h-5 w-5" /> 1. Define Your Strategy</h3>
            <div>
              <Label htmlFor="pineScript" className="text-sm font-medium">Pine Script</Label>
              <Textarea id="pineScript" name="pineScript" value={formData.pineScript || ''} onChange={handleInputChange} placeholder="Paste your Pine Script code here..." className="mt-1 h-52 font-mono text-xs bg-muted/30 focus:bg-background" disabled={isSaving || isValidating} />
            </div>
            <div>
              <Label htmlFor="explanation" className="text-sm font-medium">Strategy Explanation (Natural Language)</Label>
              <Textarea id="explanation" name="explanation" value={formData.explanation || ''} onChange={handleInputChange} placeholder="Explain how your strategy works (indicators, entry/exit conditions, risk management ideas, etc.)..." className="mt-1 h-32 bg-muted/30 focus:bg-background" disabled={isSaving || isValidating} />
            </div>
             <div>
                <Label htmlFor="capital" className="text-sm font-medium">Your Trading Capital (USD - for bot context)</Label>
                <Input id="capital" name="capital" type="number" value={formData.capital} onChange={handleInputChange} placeholder="e.g., 1000" disabled={isSaving || isValidating} className="mt-1 bg-muted/30 focus:bg-background" />
                 <p className="text-xs text-muted-foreground mt-1">This value is saved for your bot's reference. Actual trade sizing logic is handled by your backend bot.</p>
            </div>
            <Button type="button" onClick={handleValidate} variant="outline" disabled={isValidating || isSaving || (!formData.pineScript?.trim() && !formData.explanation?.trim())} className="w-full sm:w-auto">
              {isValidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Validate Consistency (AI)
            </Button>
            {validationResult && (
              <Alert variant={validationResult.isConsistent ? "default" : "destructive"} className={`mt-3 ${validationResult.isConsistent ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300" : "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300"}`}>
                <AlertTitle className="flex items-center font-semibold">
                   {validationResult.isConsistent ? <CheckCircle2 className="mr-2 h-5 w-5"/> : <AlertTriangle className="mr-2 h-5 w-5"/>}
                   AI Validation: {validationResult.isConsistent ? "Consistent" : "Potential Mismatches"}
                </AlertTitle>
                <AlertDescription className="whitespace-pre-wrap text-sm">{validationResult.feedback}</AlertDescription>
              </Alert>
            )}
          </section>

          <Separator />

          {/* Section 2: Configure Bot & Activate */}
          <section className="space-y-6 p-6 border rounded-lg shadow-sm bg-card">
            <h3 className="text-xl font-semibold flex items-center text-primary"><BotIcon className="mr-2 h-5 w-5" /> 2. Configure Bot & Activate</h3>
             <Alert variant="default" className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                <Info className="h-5 w-5" />
                <AlertTitle className="font-semibold">Manual Configuration Required</AlertTitle>
                <AlertDescription>
                Manually enter all parameters for your bot below. These exact settings will be saved to Firestore and used by your backend trading bot.
                Ensure Stop Loss and Take Profit multipliers reflect your strategy's risk management.
                </AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="targetSymbols" className="text-sm font-medium">Target Symbols (comma-separated) <span className="text-red-500">*</span></Label>
                    <Input id="targetSymbols" name="targetSymbols" value={formData.targetSymbols} onChange={handleInputChange} placeholder="e.g., BTCUSDT, ETHUSDT" disabled={isSaving} className="mt-1 bg-muted/30 focus:bg-background" />
                </div>
                <div>
                    <Label htmlFor="timeframe" className="text-sm font-medium">Trading Timeframe <span className="text-red-500">*</span></Label>
                    <Select value={formData.timeframe} onValueChange={handleTimeframeChange} disabled={isSaving}>
                        <SelectTrigger className="mt-1 bg-muted/30 focus:bg-background">
                            <SelectValue placeholder="Select timeframe" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableTimeframes.map(tf => (
                                <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
             <div>
                <Label htmlFor="tradeAmountUSD" className="text-sm font-medium">Trade Amount (USD) per Position <span className="text-red-500">*</span></Label>
                <Input id="tradeAmountUSD" name="tradeAmountUSD" type="number" value={formData.tradeAmountUSD || ''} onChange={handleInputChange} placeholder="e.g., 100 (for $100 per trade)" disabled={isSaving} className="mt-1 bg-muted/30 focus:bg-background" />
                <p className="text-xs text-muted-foreground mt-1">Your backend bot must be programmed to use this USD amount to calculate asset quantity per trade.</p>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label htmlFor="emaShortPeriod" className="text-sm font-medium">EMA Short Period</Label><Input id="emaShortPeriod" name="emaShortPeriod" type="number" value={formData.emaShortPeriod || ''} onChange={handleInputChange} placeholder="e.g., 9" disabled={isSaving} className="mt-1 bg-muted/30 focus:bg-background" /></div>
                <div><Label htmlFor="emaMediumPeriod" className="text-sm font-medium">EMA Medium Period</Label><Input id="emaMediumPeriod" name="emaMediumPeriod" type="number" value={formData.emaMediumPeriod || ''} onChange={handleInputChange} placeholder="e.g., 21" disabled={isSaving} className="mt-1 bg-muted/30 focus:bg-background" /></div>
                <div><Label htmlFor="emaLongPeriod" className="text-sm font-medium">EMA Long Period</Label><Input id="emaLongPeriod" name="emaLongPeriod" type="number" value={formData.emaLongPeriod || ''} onChange={handleInputChange} placeholder="e.g., 55" disabled={isSaving} className="mt-1 bg-muted/30 focus:bg-background" /></div>
            </div>
            <div>
                <Label htmlFor="atrPeriod" className="text-sm font-medium">ATR Period (for SL/TP) <span className="text-red-500">*</span></Label>
                <Input id="atrPeriod" name="atrPeriod" type="number" value={formData.atrPeriod || ''} onChange={handleInputChange} placeholder="e.g., 14" disabled={isSaving} className="mt-1 bg-muted/30 focus:bg-background" />
                <p className="text-xs text-muted-foreground mt-1">Required if using ATR-based Stop Loss/Take Profit multipliers.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="stopLossMultiplier" className="text-sm font-medium">Stop Loss Multiplier (ATR-based) <span className="text-red-500">*</span></Label>
                    <Input id="stopLossMultiplier" name="stopLossMultiplier" type="number" step="0.1" value={formData.stopLossMultiplier || ''} onChange={handleInputChange} placeholder="e.g., 1.5 (for 1.5 * ATR)" disabled={isSaving} className="mt-1 bg-muted/30 focus:bg-background" />
                </div>
                <div>
                    <Label htmlFor="takeProfitMultiplier" className="text-sm font-medium">Take Profit Multiplier (ATR-based) <span className="text-red-500">*</span></Label>
                    <Input id="takeProfitMultiplier" name="takeProfitMultiplier" type="number" step="0.1" value={formData.takeProfitMultiplier || ''} onChange={handleInputChange} placeholder="e.g., 3 (for 3 * ATR)" disabled={isSaving} className="mt-1 bg-muted/30 focus:bg-background" />
                </div>
            </div>
             <p className="text-xs text-muted-foreground -mt-3">These multipliers are applied to the ATR value by your backend bot. Ensure they align with your strategy's risk management.</p>

             <div className={`p-4 rounded-md ${formData.tradingEnabled && areRequiredFieldsMissingForActivation ? 'border-red-500 border bg-red-500/10' : ''}`}>
                <Label htmlFor="tradingEnabled" className="flex items-center justify-between text-sm font-medium">
                <span className="flex items-center"><Power className="mr-2 h-5 w-5"/>Trading Enabled (Activate Bot)</span>
                <Switch id="tradingEnabled" name="tradingEnabled" checked={formData.tradingEnabled} onCheckedChange={handleSwitchChange} disabled={isSaving} />
                </Label>
                 <p className="text-xs text-muted-foreground mt-1">
                   This switch tells your <span className="font-semibold">backend trading bot</span> whether to start or stop its trading activities based on the saved configuration.
                   {formData.tradingEnabled && areRequiredFieldsMissingForActivation && <span className="text-red-600 dark:text-red-400 font-semibold"> Required fields (*) must be filled to enable trading.</span>}
                 </p>
            </div>

            <Button type="submit" disabled={isSaveDisabled} className="w-full text-base py-3 h-12">
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              Save Strategy & Bot Configuration
            </Button>
          </section>
        </form>
      </CardContent>
    </Card>
  );
}
