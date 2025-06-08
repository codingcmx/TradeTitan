
'use client';

import { useEffect, useState, useTransition, useCallback, useRef } from 'react';
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
import { Loader2, Save, FileText, Wand2, AlertTriangle, CheckCircle2, Bot as BotIcon, Info, Power, Clock, DollarSign, BrainCircuit } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// strategy-config-suggester-flow is no longer used for auto-filling here based on latest user feedback

interface StrategyFormData extends CustomStrategyDoc, Partial<Omit<BotConfig, 'targetSymbols' | 'capital' | 'tradeAmountUSD' | 'emaShortPeriod' | 'emaMediumPeriod' | 'emaLongPeriod' | 'atrPeriod' | 'stopLossMultiplier' | 'takeProfitMultiplier'>> {
  capital: string; // Keep as string for form input
  targetSymbols: string; // Keep as string for form input
  emaShortPeriod?: string;
  emaMediumPeriod?: string;
  emaLongPeriod?: string;
  atrPeriod?: string;
  stopLossMultiplier?: string;
  takeProfitMultiplier?: string;
  // tradeAmountUSD removed
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
};

const availableTimeframes = [
  { value: '1m', label: '1 Minute' }, { value: '3m', label: '3 Minutes' }, { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' }, { value: '30m', label: '30 Minutes' }, { value: '1h', label: '1 Hour' },
  { value: '2h', label: '2 Hours' }, { value: '4h', label: '4 Hours' }, { value: '6h', label: '6 Hours' },
  { value: '8h', label: '8 Hours' }, { value: '12h', label: '12 Hours' }, { value: '1d', label: '1 Day' },
  { value: '3d', label: '3 Days' }, { value: '1w', label: '1 Week' },
];


export function StrategyDevelopmentCard() {
  const [formData, setFormData] = useState<StrategyFormData>(initialFormState);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const [isSaving, startSaveTransition] = useTransition();
  const [isValidating, startValidationTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<StrategyValidationOutput | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false); // For validation, not parameter suggestion

  const { toast } = useToast();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  const loadInitialData = useCallback(async () => {
    setIsLoadingInitialData(true);
    setError(null);
    try {
      const [doc, config] = await Promise.all([
        getCustomStrategyDoc(),
        getBotConfiguration()
      ]);

      const newFormData: StrategyFormData = {
        ...initialFormState, // Start with defaults
        pineScript: doc.pineScript || '',
        explanation: doc.explanation || '',
        capital: config?.capital?.toString() || initialFormState.capital,
        targetSymbols: Array.isArray(config.targetSymbols) ? config.targetSymbols.join(', ') : (config.targetSymbols || ''),
        emaShortPeriod: config.emaShortPeriod?.toString() || '',
        emaMediumPeriod: config.emaMediumPeriod?.toString() || '',
        emaLongPeriod: config.emaLongPeriod?.toString() || '',
        atrPeriod: config.atrPeriod?.toString() || '',
        stopLossMultiplier: config.stopLossMultiplier?.toString() || '',
        takeProfitMultiplier: config.takeProfitMultiplier?.toString() || '',
        tradingEnabled: config.tradingEnabled || false,
        timeframe: config.timeframe || initialFormState.timeframe,
      };
      setFormData(newFormData);

    } catch (err: any) {
      console.error("Error fetching initial strategy data:", err);
      const msg = err.message || "Failed to load initial strategy data.";
      setError(msg);
      toast({ title: "Loading Error", description: msg, variant: "destructive" });
    } finally {
      setIsLoadingInitialData(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); // Removed auto-analysis dependencies

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);


  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'pineScript' || name === 'explanation') {
        setValidationResult(null); // Clear previous validation result
    }
    setError(null); // Clear general errors on input change
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
      setIsAiAnalyzing(true);
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
      } finally {
        setIsAiAnalyzing(false);
      }
    });
  };

  const checkRequiredFields = useCallback(() : boolean => {
    if (!formData.targetSymbols?.trim()) return false;
    if (formData.atrPeriod === '' || formData.atrPeriod === undefined || isNaN(Number(formData.atrPeriod))) return false;
    if (formData.stopLossMultiplier === '' || formData.stopLossMultiplier === undefined || isNaN(Number(formData.stopLossMultiplier))) return false;
    if (formData.takeProfitMultiplier === '' || formData.takeProfitMultiplier === undefined || isNaN(Number(formData.takeProfitMultiplier))) return false;
    if (!formData.timeframe) return false;
    // tradeAmountUSD check removed from here
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
        setError("Cannot enable trading. Please ensure Target Symbols, Timeframe, ATR Period, Stop Loss Multiplier, and Take Profit Multiplier are filled correctly.");
        toast({ title: "Configuration Incomplete", description: "Required fields (*) are missing to enable trading.", variant: "destructive"});
        return;
    }

    const configToSave: BotConfig = {
      targetSymbols: formData.targetSymbols.split(',').map(s => s.trim()).filter(Boolean),
      emaShortPeriod: formData.emaShortPeriod !== '' && formData.emaShortPeriod !== undefined && !isNaN(Number(formData.emaShortPeriod)) ? Number(formData.emaShortPeriod) : undefined,
      emaMediumPeriod: formData.emaMediumPeriod !== '' && formData.emaMediumPeriod !== undefined && !isNaN(Number(formData.emaMediumPeriod)) ? Number(formData.emaMediumPeriod) : undefined,
      emaLongPeriod: formData.emaLongPeriod !== '' && formData.emaLongPeriod !== undefined && !isNaN(Number(formData.emaLongPeriod)) ? Number(formData.emaLongPeriod) : undefined,
      atrPeriod: formData.atrPeriod !== '' && formData.atrPeriod !== undefined && !isNaN(Number(formData.atrPeriod)) ? Number(formData.atrPeriod) : undefined,
      stopLossMultiplier: formData.stopLossMultiplier !== '' && formData.stopLossMultiplier !== undefined && !isNaN(Number(formData.stopLossMultiplier)) ? Number(formData.stopLossMultiplier) : undefined,
      takeProfitMultiplier: formData.takeProfitMultiplier !== '' && formData.takeProfitMultiplier !== undefined && !isNaN(Number(formData.takeProfitMultiplier)) ? Number(formData.takeProfitMultiplier) : undefined,
      tradingEnabled: formData.tradingEnabled,
      capital: parsedCapital,
      timeframe: formData.timeframe,
      // tradeAmountUSD removed
    };

    startSaveTransition(async () => {
      const result = await saveStrategyAndConfigurationAction({
        pineScript: formData.pineScript || '',
        explanation: formData.explanation || '',
        configToSave,
      });

      if (result.success) {
        toast({ title: 'Success', description: "Strategy and bot configuration saved! Bot status in header should update shortly." });
        // Re-fetch or update state to reflect server-side changes (especially if validation forced tradingEnabled to false)
        const updatedConfig = await getBotConfiguration(); // Re-fetch
        setFormData(prev => ({
            ...prev, // Keep current form values for Pine/explanation
            pineScript: formData.pineScript || '',
            explanation: formData.explanation || '',
            // Update config part from fetched data
            capital: updatedConfig.capital?.toString() || prev.capital,
            targetSymbols: Array.isArray(updatedConfig.targetSymbols) ? updatedConfig.targetSymbols.join(', ') : (updatedConfig.targetSymbols || ''),
            emaShortPeriod: updatedConfig.emaShortPeriod?.toString() || '',
            emaMediumPeriod: updatedConfig.emaMediumPeriod?.toString() || '',
            emaLongPeriod: updatedConfig.emaLongPeriod?.toString() || '',
            atrPeriod: updatedConfig.atrPeriod?.toString() || '',
            stopLossMultiplier: updatedConfig.stopLossMultiplier?.toString() || '',
            takeProfitMultiplier: updatedConfig.takeProfitMultiplier?.toString() || '',
            tradingEnabled: updatedConfig.tradingEnabled || false,
            timeframe: updatedConfig.timeframe || initialFormState.timeframe,
        }));

      } else {
        toast({ title: 'Error Saving', description: result.message || 'An unknown error occurred during save.', variant: 'destructive' });
        setError(result.message || 'Failed to save.');
         // If save failed due to server-side validation (e.g. forced tradingEnabled to false), reflect that
        if (result.message && result.message.includes("Cannot enable trading")) {
            setFormData(prev => ({ ...prev, tradingEnabled: false }));
        }
      }
    });
  };

  useEffect(() => {
    if (formData.tradingEnabled && !checkRequiredFields()) {
      setError("Required fields (*) must be filled to enable trading.");
    } else if (error === "Required fields (*) must be filled to enable trading.") {
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.tradingEnabled, formData.targetSymbols, formData.atrPeriod, formData.stopLossMultiplier, formData.takeProfitMultiplier, formData.timeframe]);


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

  const isActionDisabled = isSaving || isValidating || isLoadingInitialData || isAiAnalyzing;
  const areRequiredFieldsMissingForActivation = formData.tradingEnabled && !checkRequiredFields();


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><BotIcon className="mr-2 h-6 w-6 text-primary" /> Bot & Strategy Hub</CardTitle>
        <CardDescription>
          Define your strategy, validate its consistency with AI, then manually configure and activate your backend bot.
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
              <Textarea id="pineScript" name="pineScript" value={formData.pineScript || ''} onChange={handleInputChange} placeholder="Paste your Pine Script code here..." className="mt-1 h-52 font-mono text-xs bg-muted/30 focus:bg-background" disabled={isActionDisabled} />
            </div>
            <div>
              <Label htmlFor="explanation" className="text-sm font-medium">Strategy Explanation (Natural Language)</Label>
              <Textarea id="explanation" name="explanation" value={formData.explanation || ''} onChange={handleInputChange} placeholder="Explain how your strategy works (indicators, entry/exit conditions, risk management ideas, etc.)..." className="mt-1 h-32 bg-muted/30 focus:bg-background" disabled={isActionDisabled} />
            </div>
             <div>
                <Label htmlFor="capital" className="text-sm font-medium">Your Trading Capital (USD - for bot context)</Label>
                <Input id="capital" name="capital" type="number" value={formData.capital} onChange={handleInputChange} placeholder="e.g., 1000" disabled={isActionDisabled} className="mt-1 bg-muted/30 focus:bg-background" />
                 <p className="text-xs text-muted-foreground mt-1">This value is saved for your bot's reference. Actual trade sizing logic is handled by your backend bot.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
                <Button type="button" onClick={handleValidate} variant="outline" disabled={isActionDisabled || (!formData.pineScript?.trim() && !formData.explanation?.trim())} className="w-full sm:w-auto">
                {isValidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Validate Consistency (AI)
                </Button>
                {isAiAnalyzing && <span className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />AI is analyzing...</span>}
            </div>

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
                Your Pine Script is for documentation and AI validation; it is not directly executed by the backend.
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
            {/* tradeAmountUSD input removed from here */}

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

            <Button type="submit" disabled={isActionDisabled} className="w-full text-base py-3 h-12">
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              Save Strategy & Bot Configuration
            </Button>
          </section>
        </form>
      </CardContent>
    </Card>
  );
}
