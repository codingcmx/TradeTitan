
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
import { suggestBotConfigParameters, type StrategyConfigSuggesterInput, type StrategyConfigSuggesterOutput } from '@/ai/flows/strategy-config-suggester-flow';
import { saveStrategyAndConfigurationAction } from '@/app/actions';

import { Loader2, Save, FileText, Wand2, AlertTriangle, CheckCircle2, Bot as BotIcon, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

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
};

// Simple debounce function
function debounce<T extends (...args: any[]) => void>(func: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}


export function StrategyDevelopmentCard() {
  const [formData, setFormData] = useState<StrategyFormData>(initialFormState);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  
  const [isSaving, startSaveTransition] = useTransition();
  const [isValidating, startValidationTransition] = useTransition();
  const [isSuggestingParameters, setIsSuggestingParameters] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<StrategyValidationOutput | null>(null);
  // suggestionResult state is still needed for auto-filling, but its textual parts (summary, warnings, assumptions) won't be displayed
  const [suggestionResult, setSuggestionResult] = useState<StrategyConfigSuggesterOutput | null>(null);
  const { toast } = useToast();

  const triggerAiSuggestions = useCallback(async (script: string, expl: string, cap: string) => {
    if ((!script?.trim() && !expl?.trim())) {
      setSuggestionResult(null); 
      return;
    }

    const parsedCapital = parseFloat(cap);
    if (isNaN(parsedCapital) || parsedCapital <= 0) {
      return;
    }

    setIsSuggestingParameters(true);
    setError(null); 

    const input: StrategyConfigSuggesterInput = {
        strategyDescription: `PINE SCRIPT:\n\`\`\`pinescript\n${script || 'No Pine Script provided.'}\n\`\`\`\n\nEXPLANATION:\n${expl || 'No explanation provided.'}`,
        capital: parsedCapital,
    };
    try {
        const result = await suggestBotConfigParameters(input);
        setSuggestionResult(result); // Still set this for auto-filling
        
        setFormData(prev => ({
            ...prev,
            targetSymbols: result.suggestions.targetSymbols?.join(', ') || prev.targetSymbols,
            emaShortPeriod: result.suggestions.emaShortPeriod?.toString() ?? prev.emaShortPeriod,
            emaMediumPeriod: result.suggestions.emaMediumPeriod?.toString() ?? prev.emaMediumPeriod,
            emaLongPeriod: result.suggestions.emaLongPeriod?.toString() ?? prev.emaLongPeriod,
            atrPeriod: result.suggestions.atrPeriod?.toString() ?? prev.atrPeriod,
            stopLossMultiplier: result.suggestions.stopLossMultiplier?.toString() ?? prev.stopLossMultiplier,
            takeProfitMultiplier: result.suggestions.takeProfitMultiplier?.toString() ?? prev.takeProfitMultiplier,
        }));
        if (result.warnings && result.warnings.length > 0) {
          toast({
            title: "AI Suggestions Applied (with warnings)",
            description: "Some parameters were auto-filled. Review AI warnings in console/notifications and settings carefully.",
            variant: "default",
          });
        } else if (Object.keys(result.suggestions).length > 0) {
           toast({
            title: "AI Suggestions Applied",
            description: "Relevant parameters have been auto-filled based on your strategy input. Please review.",
            variant: "default",
          });
        }


    } catch (err: any) {
        console.error("Error suggesting parameters:", err);
        const msg = err.message || "Failed to get parameter suggestions from AI.";
        setSuggestionResult({
            suggestions: {},
            summary: "Error fetching AI suggestions.",
            warnings: [msg]
        });
         toast({
            title: "AI Suggestion Error",
            description: msg,
            variant: "destructive",
        });
    } finally {
        setIsSuggestingParameters(false);
    }
  }, [toast]); 

  const debouncedTriggerAiSuggestions = useCallback(debounce(triggerAiSuggestions, 1500), [triggerAiSuggestions]);


  useEffect(() => {
    async function fetchInitialData() {
      setIsLoadingInitialData(true);
      setError(null);
      try {
        const [doc, config] = await Promise.all([
          getCustomStrategyDoc(),
          getBotConfiguration()
        ]);
        
        const initialPine = doc.pineScript || '';
        const initialExplanation = doc.explanation || '';
        // Use loaded capital if available from config, otherwise form default, then component default
        const loadedCapital = config?.capital?.toString() || formData.capital || initialFormState.capital;


        setFormData(prev => ({
          ...prev,
          pineScript: initialPine,
          explanation: initialExplanation,
          capital: loadedCapital, 
          targetSymbols: Array.isArray(config.targetSymbols) ? config.targetSymbols.join(', ') : '',
          emaShortPeriod: config.emaShortPeriod?.toString() || '',
          emaMediumPeriod: config.emaMediumPeriod?.toString() || '',
          emaLongPeriod: config.emaLongPeriod?.toString() || '',
          atrPeriod: config.atrPeriod?.toString() || '',
          stopLossMultiplier: config.stopLossMultiplier?.toString() || '',
          takeProfitMultiplier: config.takeProfitMultiplier?.toString() || '',
          tradingEnabled: config.tradingEnabled || false,
        }));

        if (initialPine.trim() || initialExplanation.trim()) {
          // Trigger initial suggestion without debounce
          triggerAiSuggestions(initialPine, initialExplanation, loadedCapital);
        }

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
  }, []);  // triggerAiSuggestions is stable. formData.capital removed to avoid loop.
  
  // Store initial bot config to revert if script/explanation is cleared
  const [getBotConfigurationResult, setGetBotConfigurationResult] = useState<BotConfig | null>(null);
   useEffect(() => {
    getBotConfiguration().then(config => setGetBotConfigurationResult(config));
  }, []);


  useEffect(() => {
    if (!isLoadingInitialData) { // Only run after initial data load
        if (formData.pineScript?.trim() || formData.explanation?.trim()) {
             debouncedTriggerAiSuggestions(formData.pineScript || '', formData.explanation || '', formData.capital);
        } else {
            // If both script and explanation are cleared, clear suggestions and revert auto-filled fields
            setSuggestionResult(null);
             setFormData(prev => ({
                ...prev, // Keep pineScript, explanation, capital as they are (empty)
                targetSymbols: getBotConfigurationResult?.targetSymbols?.join(', ') || '', 
                emaShortPeriod: getBotConfigurationResult?.emaShortPeriod?.toString() || '',
                emaMediumPeriod: getBotConfigurationResult?.emaMediumPeriod?.toString() || '',
                emaLongPeriod: getBotConfigurationResult?.emaLongPeriod?.toString() || '',
                atrPeriod: getBotConfigurationResult?.atrPeriod?.toString() || '',
                stopLossMultiplier: getBotConfigurationResult?.stopLossMultiplier?.toString() || '',
                takeProfitMultiplier: getBotConfigurationResult?.takeProfitMultiplier?.toString() || '',
                // tradingEnabled should not be reset here, keep its current state
            }));
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.pineScript, formData.explanation, formData.capital, isLoadingInitialData, debouncedTriggerAiSuggestions]);
  


  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    // @ts-ignore
    const checked = isCheckbox ? e.target.checked : undefined;

    setFormData(prev => ({
      ...prev,
      [name]: isCheckbox ? checked : value,
    }));
     
    if (name === 'pineScript' || name === 'explanation') {
        setValidationResult(null); // Clear validation if script/explanation changes
    }
  };

  const handleSwitchChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      tradingEnabled: checked,
    }));
  };

  const handleValidate = async () => {
    setError(null);
    setValidationResult(null);
    if (!formData.pineScript?.trim() && !formData.explanation?.trim()) {
      setError("Please provide both Pine Script and an explanation before validating.");
      toast({
        title: 'Input Missing',
        description: "Pine Script and explanation are required for validation.",
        variant: 'destructive',
      });
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
  
  const handleSaveStrategyAndConfig = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parsedCapital = parseFloat(formData.capital);
    if (isNaN(parsedCapital) || parsedCapital <= 0) {
        setError("Capital must be a positive number.");
        toast({ title: "Input Error", description: "Capital must be a positive number.", variant: "destructive" });
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
      capital: parsedCapital, // Save capital as part of bot_config as well for reference
    };
    
    if ((configToSave.stopLossMultiplier || configToSave.takeProfitMultiplier) && !configToSave.atrPeriod) {
        setError("ATR Period is required if Stop Loss or Take Profit Multipliers are set (as they are ATR-based).");
        toast({ title: "Configuration Error", description: "ATR Period is required for ATR-based SL/TP.", variant: "destructive"});
        return;
    }
    if (configToSave.atrPeriod && (!configToSave.stopLossMultiplier || !configToSave.takeProfitMultiplier)) {
        // Allow setting ATR period without SL/TP if user intends to use ATR for other purposes or sets SL/TP differently in bot
        // But if they are trying to use ATR-based SL/TP, they need both.
        // For now, we'll make them optional if ATR period is set.
        // The AI prompt should warn about this.
    }

    startSaveTransition(async () => {
      const result = await saveStrategyAndConfigurationAction({
        pineScript: formData.pineScript || '',
        explanation: formData.explanation || '',
        configToSave,
      });

      if (result.success) {
        toast({ title: 'Success', description: result.message });
      } else {
        toast({ title: 'Error Saving', description: result.message || 'An unknown error occurred during save.', variant: 'destructive' });
        setError(result.message || 'Failed to save.');
      }
    });
  };

  if (isLoadingInitialData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><BotIcon className="mr-2 h-6 w-6 text-primary" /> Bot & Strategy Hub</CardTitle>
          <CardDescription>Define, validate, and configure your trading strategy with AI assistance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex flex-col items-center justify-center h-64">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="text-center text-muted-foreground">Loading strategy data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><BotIcon className="mr-2 h-6 w-6 text-primary" /> Bot & Strategy Hub</CardTitle>
        <CardDescription>
          Input your Pine Script and explanation. AI will automatically suggest parameters. Review, adjust, and then configure & activate your bot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSaveStrategyAndConfig} className="space-y-8">
          {/* Section 1: Strategy Input & Validation */}
          <section className="space-y-4 p-6 border rounded-lg shadow-sm bg-card">
            <h3 className="text-xl font-semibold flex items-center text-primary"><FileText className="mr-2 h-5 w-5" /> 1. Define Your Strategy</h3>
            <div>
              <Label htmlFor="pineScript" className="text-sm font-medium">Pine Script</Label>
              <Textarea id="pineScript" name="pineScript" value={formData.pineScript || ''} onChange={handleInputChange} placeholder="Paste your Pine Script code here... AI will analyze as you type/paste." className="mt-1 h-52 font-mono text-xs bg-muted/30 focus:bg-background" disabled={isSaving || isValidating} />
            </div>
            <div>
              <Label htmlFor="explanation" className="text-sm font-medium">Strategy Explanation (Natural Language)</Label>
              <Textarea id="explanation" name="explanation" value={formData.explanation || ''} onChange={handleInputChange} placeholder="Explain how your strategy works... AI will analyze as you type/paste." className="mt-1 h-32 bg-muted/30 focus:bg-background" disabled={isSaving || isValidating} />
            </div>
             <div>
                <Label htmlFor="capital" className="text-sm font-medium">Your Trading Capital (for AI context & reference)</Label>
                <Input id="capital" name="capital" type="number" value={formData.capital} onChange={handleInputChange} placeholder="e.g., 1000" disabled={isSaving || isValidating} className="mt-1 bg-muted/30 focus:bg-background" />
            </div>
            <Button type="button" onClick={handleValidate} variant="outline" disabled={isValidating || isSaving || (!formData.pineScript?.trim() && !formData.explanation?.trim())} className="w-full sm:w-auto">
              {isValidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Validate Consistency (AI)
            </Button>
            {isSuggestingParameters && (
                <div className="flex items-center text-sm text-muted-foreground mt-2">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    AI is analyzing your strategy to suggest parameters...
                </div>
            )}
            {validationResult && (
              <Alert variant={validationResult.isConsistent ? "default" : "destructive"} className={`mt-3 ${validationResult.isConsistent ? "bg-green-500/10 border-green-500/30 text-green-700" : "bg-yellow-500/10 border-yellow-500/30 text-yellow-700"}`}>
                <AlertTitle className="flex items-center font-semibold">
                   {validationResult.isConsistent ? <CheckCircle2 className="mr-2 h-5 w-5"/> : <AlertTriangle className="mr-2 h-5 w-5"/>}
                   AI Validation: {validationResult.isConsistent ? "Consistent" : "Potential Mismatches"}
                </AlertTitle>
                <AlertDescription className="whitespace-pre-wrap text-sm">{validationResult.feedback}</AlertDescription>
              </Alert>
            )}
            {/* AI Parameter Analysis display is removed as per user request */}
          </section>
          
          <Separator />

          {/* Section 2: Bot Configuration & Activation */}
          <section className="space-y-6 p-6 border rounded-lg shadow-sm bg-card">
            <h3 className="text-xl font-semibold flex items-center text-primary"><BotIcon className="mr-2 h-5 w-5" /> 2. Configure Bot & Activate</h3>
             <p className="text-sm text-muted-foreground -mt-4">
              Fields below may be auto-filled by AI analysis of your script (Section 1). Review and adjust as needed. 
              <span className="font-semibold">Especially ensure Stop Loss and Take Profit multipliers are appropriate for your risk strategy.</span>
            </p>
            <div>
                <Label htmlFor="targetSymbols" className="text-sm font-medium">Target Symbols (comma-separated)</Label>
                <Input id="targetSymbols" name="targetSymbols" value={formData.targetSymbols} onChange={handleInputChange} placeholder="e.g., BTCUSDT, ETHUSDT (AI Suggested)" disabled={isSaving} className="mt-1 bg-muted/30 focus:bg-background" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label htmlFor="emaShortPeriod" className="text-sm font-medium">EMA Short</Label><Input id="emaShortPeriod" name="emaShortPeriod" type="number" value={formData.emaShortPeriod || ''} onChange={handleInputChange} placeholder="e.g., 9 (AI Suggested)" disabled={isSaving} className="mt-1 bg-muted/30 focus:bg-background" /></div>
                <div><Label htmlFor="emaMediumPeriod" className="text-sm font-medium">EMA Medium</Label><Input id="emaMediumPeriod" name="emaMediumPeriod" type="number" value={formData.emaMediumPeriod || ''} onChange={handleInputChange} placeholder="e.g., 21 (AI Suggested)" disabled={isSaving} className="mt-1 bg-muted/30 focus:bg-background" /></div>
                <div><Label htmlFor="emaLongPeriod" className="text-sm font-medium">EMA Long</Label><Input id="emaLongPeriod" name="emaLongPeriod" type="number" value={formData.emaLongPeriod || ''} onChange={handleInputChange} placeholder="e.g., 55 (AI Suggested)" disabled={isSaving} className="mt-1 bg-muted/30 focus:bg-background" /></div>
            </div>
            <div>
                <Label htmlFor="atrPeriod" className="text-sm font-medium">ATR Period (for SL/TP)</Label>
                <Input id="atrPeriod" name="atrPeriod" type="number" value={formData.atrPeriod || ''} onChange={handleInputChange} placeholder="e.g., 14 (AI Suggested)" disabled={isSaving} className="mt-1 bg-muted/30 focus:bg-background" />
                <p className="text-xs text-muted-foreground mt-1">Required if using ATR-based Stop Loss/Take Profit multipliers.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="stopLossMultiplier" className="text-sm font-medium">Stop Loss Multiplier (ATR-based)</Label>
                    <Input id="stopLossMultiplier" name="stopLossMultiplier" type="number" step="0.1" value={formData.stopLossMultiplier || ''} onChange={handleInputChange} placeholder="e.g., 1.5 (Set Manually or AI Suggested)" disabled={isSaving} className="mt-1 bg-muted/30 focus:bg-background" />
                </div>
                <div>
                    <Label htmlFor="takeProfitMultiplier" className="text-sm font-medium">Take Profit Multiplier (ATR-based)</Label>
                    <Input id="takeProfitMultiplier" name="takeProfitMultiplier" type="number" step="0.1" value={formData.takeProfitMultiplier || ''} onChange={handleInputChange} placeholder="e.g., 3 (Set Manually or AI Suggested)" disabled={isSaving} className="mt-1 bg-muted/30 focus:bg-background" />
                </div>
            </div>
             <p className="text-xs text-muted-foreground -mt-3">These multipliers are applied to the ATR value. Ensure they align with your strategy's risk management. If AI didn't suggest these from your script, you MUST set them if your strategy uses ATR-based exits.</p>
             <div>
                <Label htmlFor="tradingEnabled" className="flex items-center justify-between text-sm font-medium">
                <span>Trading Enabled (Activate Bot)</span>
                <Switch id="tradingEnabled" name="tradingEnabled" checked={formData.tradingEnabled} onCheckedChange={handleSwitchChange} disabled={isSaving} />
                </Label>
                 <p className="text-xs text-muted-foreground mt-1">This will enable/disable the bot based on the saved configuration.</p>
            </div>
            <Button type="submit" disabled={isSaving || isValidating || isLoadingInitialData || isSuggestingParameters} className="w-full text-base py-3 h-12">
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              Save Strategy & Bot Configuration
            </Button>
          </section>
        </form>
      </CardContent>
    </Card>
  );
}

    