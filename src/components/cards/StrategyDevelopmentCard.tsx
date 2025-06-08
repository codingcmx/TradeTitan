
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { CustomStrategyDoc, BotConfig } from '@/types';
import { getCustomStrategyDoc, getBotConfiguration } from '@/lib/firestoreService'; // Added getBotConfiguration
// import { saveCustomStrategyDocAction } from '@/app/actions'; // Will be replaced
import { validateStrategyConsistency, type StrategyValidationOutput } from '@/ai/flows/strategy-validator-flow';
import { suggestBotConfigParameters, type StrategyConfigSuggesterInput, type StrategyConfigSuggesterOutput, type SuggestedBotConfig } from '@/ai/flows/strategy-config-suggester-flow';
import { saveStrategyAndConfigurationAction } from '@/app/actions'; // New action to be created

import { Loader2, Save, FileText, Wand2, AlertTriangle, CheckCircle2, Bot as BotIcon, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

interface StrategyFormData extends CustomStrategyDoc {
  capital: string;
  targetSymbols: string; // Comma-separated string for input
  emaShortPeriod?: number | string; // Allow string for input, parse to number
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

export function StrategyDevelopmentCard() {
  const [formData, setFormData] = useState<StrategyFormData>(initialFormState);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  
  const [isSaving, startSaveTransition] = useTransition();
  const [isValidating, startValidationTransition] = useTransition();
  const [isSuggesting, startSuggestionTransition] = useTransition();
  
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<StrategyValidationOutput | null>(null);
  const [suggestionResult, setSuggestionResult] = useState<StrategyConfigSuggesterOutput | null>(null);
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
        
        setFormData({
          pineScript: doc.pineScript || '',
          explanation: doc.explanation || '',
          capital: formData.capital, // Keep existing capital or default
          targetSymbols: Array.isArray(config.targetSymbols) ? config.targetSymbols.join(', ') : '',
          emaShortPeriod: config.emaShortPeriod || '',
          emaMediumPeriod: config.emaMediumPeriod || '',
          emaLongPeriod: config.emaLongPeriod || '',
          atrPeriod: config.atrPeriod || '',
          stopLossMultiplier: config.stopLossMultiplier || '',
          takeProfitMultiplier: config.takeProfitMultiplier || '',
          tradingEnabled: config.tradingEnabled || false,
        });

      } catch (err: any) {
        console.error("Error fetching initial strategy data:", err);
        setError(err.message || "Failed to load initial strategy data.");
        toast({ title: "Loading Error", description: "Could not load existing strategy data.", variant: "destructive" });
      } finally {
        setIsLoadingInitialData(false);
      }
    }
    fetchInitialData();
  }, []); // formData.capital is not a dependency here

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    // @ts-ignore
    const checked = isCheckbox ? e.target.checked : undefined;

    setFormData(prev => ({
      ...prev,
      [name]: isCheckbox ? checked : value,
    }));
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
    if (!formData.pineScript?.trim() || !formData.explanation?.trim()) {
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

  const handleSuggestParameters = async () => {
    setError(null);
    setSuggestionResult(null);
     if (!formData.pineScript?.trim() && !formData.explanation?.trim()) {
      setError("Please provide either Pine Script or an explanation to get suggestions.");
      toast({
        title: 'Input Missing',
        description: "Pine Script or explanation is required for suggestions.",
        variant: 'destructive',
      });
      return;
    }
    const parsedCapital = parseFloat(formData.capital);
    if (isNaN(parsedCapital) || parsedCapital <= 0) {
        setError("Please enter a valid positive number for capital.");
        toast({ title: "Input Error", description: "Capital must be a positive number for AI context.", variant: "destructive" });
        return;
    }

    startSuggestionTransition(async () => {
        const input: StrategyConfigSuggesterInput = {
            strategyDescription: `Pine Script:\n${formData.pineScript}\n\nExplanation:\n${formData.explanation}`,
            capital: parsedCapital,
        };
        try {
            const result = await suggestBotConfigParameters(input);
            setSuggestionResult(result);
            // Pre-fill form fields with suggestions
            setFormData(prev => ({
                ...prev,
                targetSymbols: result.suggestions.targetSymbols?.join(', ') || prev.targetSymbols,
                emaShortPeriod: result.suggestions.emaShortPeriod !== undefined ? result.suggestions.emaShortPeriod : prev.emaShortPeriod,
                emaMediumPeriod: result.suggestions.emaMediumPeriod !== undefined ? result.suggestions.emaMediumPeriod : prev.emaMediumPeriod,
                emaLongPeriod: result.suggestions.emaLongPeriod !== undefined ? result.suggestions.emaLongPeriod : prev.emaLongPeriod,
                atrPeriod: result.suggestions.atrPeriod !== undefined ? result.suggestions.atrPeriod : prev.atrPeriod,
            }));
            toast({ title: "AI Suggestions Received", description: "Review and adjust the suggested parameters below."});
        } catch (err: any)
         {
            console.error("Error suggesting parameters:", err);
            const msg = err.message || "Failed to get parameter suggestions from AI.";
            setError(msg);
            toast({ title: 'Parameter Suggestion AI Error', description: msg, variant: 'destructive' });
        }
    });
  };
  
  const handleSaveStrategyAndConfig = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const configToSave: BotConfig = {
      targetSymbols: formData.targetSymbols.split(',').map(s => s.trim()).filter(Boolean),
      emaShortPeriod: formData.emaShortPeriod !== '' && !isNaN(Number(formData.emaShortPeriod)) ? Number(formData.emaShortPeriod) : undefined,
      emaMediumPeriod: formData.emaMediumPeriod !== '' && !isNaN(Number(formData.emaMediumPeriod)) ? Number(formData.emaMediumPeriod) : undefined,
      emaLongPeriod: formData.emaLongPeriod !== '' && !isNaN(Number(formData.emaLongPeriod)) ? Number(formData.emaLongPeriod) : undefined,
      atrPeriod: formData.atrPeriod !== '' && !isNaN(Number(formData.atrPeriod)) ? Number(formData.atrPeriod) : undefined,
      stopLossMultiplier: formData.stopLossMultiplier !== '' && !isNaN(Number(formData.stopLossMultiplier)) ? Number(formData.stopLossMultiplier) : undefined,
      takeProfitMultiplier: formData.takeProfitMultiplier !== '' && !isNaN(Number(formData.takeProfitMultiplier)) ? Number(formData.takeProfitMultiplier) : undefined,
      tradingEnabled: formData.tradingEnabled,
    };
    
    // Basic validation for required fields if ATR strategy is implied
    if ( (configToSave.atrPeriod || configToSave.stopLossMultiplier || configToSave.takeProfitMultiplier) && 
         (!configToSave.atrPeriod || !configToSave.stopLossMultiplier || !configToSave.takeProfitMultiplier) ) {
        const missing = [];
        if (!configToSave.atrPeriod) missing.push("ATR Period");
        if (!configToSave.stopLossMultiplier) missing.push("Stop Loss Multiplier");
        if (!configToSave.takeProfitMultiplier) missing.push("Take Profit Multiplier");
        setError(`If using ATR-based exits, please provide: ${missing.join(', ')}.`);
        toast({ title: "Configuration Error", description: `Missing required ATR parameters: ${missing.join(', ')}.`, variant: "destructive"});
        return;
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
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
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
        <CardContent className="space-y-4">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
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
          Input your Pine Script and explanation, validate with AI, get parameter suggestions, then configure and activate your bot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSaveStrategyAndConfig} className="space-y-8">
          {/* Section 1: Strategy Input & Validation */}
          <section className="space-y-4 p-4 border rounded-md">
            <h3 className="text-lg font-semibold flex items-center"><FileText className="mr-2 h-5 w-5 text-primary/80" /> 1. Define Your Strategy</h3>
            <div>
              <Label htmlFor="pineScript">Pine Script</Label>
              <Textarea id="pineScript" name="pineScript" value={formData.pineScript} onChange={handleInputChange} placeholder="Paste your Pine Script code here..." className="mt-1 h-40 font-mono text-sm" disabled={isSaving || isValidating || isSuggesting} />
            </div>
            <div>
              <Label htmlFor="explanation">Strategy Explanation (Natural Language)</Label>
              <Textarea id="explanation" name="explanation" value={formData.explanation} onChange={handleInputChange} placeholder="Explain how your strategy works..." className="mt-1 h-28" disabled={isSaving || isValidating || isSuggesting} />
            </div>
            <Button type="button" onClick={handleValidate} variant="outline" disabled={isValidating || isSaving || isSuggesting || !formData.pineScript?.trim() || !formData.explanation?.trim()} className="w-full sm:w-auto">
              {isValidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Validate Consistency (AI)
            </Button>
            {validationResult && (
              <Alert variant={validationResult.isConsistent ? "default" : "destructive"} className={`mt-3 ${validationResult.isConsistent ? "bg-green-500/10 border-green-500/30" : "bg-yellow-500/10 border-yellow-500/30"}`}>
                <AlertTitle className="flex items-center">
                   {validationResult.isConsistent ? <CheckCircle2 className="mr-2 h-5 w-5"/> : <AlertTriangle className="mr-2 h-5 w-5"/>}
                   AI Validation: {validationResult.isConsistent ? "Consistent" : "Potential Mismatches"}
                </AlertTitle>
                <AlertDescription className="whitespace-pre-wrap text-sm">{validationResult.feedback}</AlertDescription>
              </Alert>
            )}
          </section>

          <Separator />

          {/* Section 2: AI Parameter Suggestion */}
          <section className="space-y-4 p-4 border rounded-md">
            <h3 className="text-lg font-semibold flex items-center"><Sparkles className="mr-2 h-5 w-5 text-primary/80" /> 2. Get AI Parameter Suggestions</h3>
            <div>
                <Label htmlFor="capital">Your Trading Capital (for AI context)</Label>
                <Input id="capital" name="capital" type="number" value={formData.capital} onChange={handleInputChange} placeholder="e.g., 1000" disabled={isSaving || isValidating || isSuggesting} className="mt-1" />
            </div>
            <Button type="button" onClick={handleSuggestParameters} variant="outline" disabled={isSuggesting || isSaving || isValidating || (!formData.pineScript?.trim() && !formData.explanation?.trim())} className="w-full sm:w-auto">
              {isSuggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Suggest Bot Parameters (AI)
            </Button>
            {suggestionResult && (
              <div className="mt-3 space-y-3 p-3 border rounded-md bg-muted/30">
                <h4 className="font-semibold text-md">AI Analysis & Suggestions:</h4>
                <p className="text-sm whitespace-pre-wrap"><strong>Summary:</strong> {suggestionResult.summary}</p>
                {Object.keys(suggestionResult.suggestions).length > 0 && (
                  <div>
                    <p className="text-sm font-medium">Suggested for Bot Config (review and edit below):</p>
                    <ul className="list-disc list-inside text-sm ml-4">
                      {suggestionResult.suggestions.targetSymbols?.map(s => <li key={s}>Symbol: {s}</li>)}
                      {suggestionResult.suggestions.emaShortPeriod && <li>EMA Short: {suggestionResult.suggestions.emaShortPeriod}</li>}
                      {suggestionResult.suggestions.emaMediumPeriod && <li>EMA Medium: {suggestionResult.suggestions.emaMediumPeriod}</li>}
                      {suggestionResult.suggestions.emaLongPeriod && <li>EMA Long: {suggestionResult.suggestions.emaLongPeriod}</li>}
                      {suggestionResult.suggestions.atrPeriod && <li>ATR Period: {suggestionResult.suggestions.atrPeriod}</li>}
                    </ul>
                  </div>
                )}
                {suggestionResult.aiAssumptions && <p className="text-xs italic"><strong>Assumptions:</strong> {suggestionResult.aiAssumptions}</p>}
                {suggestionResult.warnings && suggestionResult.warnings.length > 0 && (
                    <Alert variant="default" className="bg-amber-500/10 border-amber-500/30">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <AlertTitle className="text-amber-700 font-semibold">AI Warnings/Notes</AlertTitle>
                        <AlertDescription><ul className="list-disc list-inside text-sm">{suggestionResult.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></AlertDescription>
                    </Alert>
                )}
                 <p className="text-xs text-muted-foreground">AI suggestions have pre-filled relevant fields in Section 3. Please review and adjust them, especially risk parameters.</p>
              </div>
            )}
          </section>
          
          <Separator />

          {/* Section 3: Bot Configuration & Activation */}
          <section className="space-y-6 p-4 border rounded-md">
            <h3 className="text-lg font-semibold flex items-center"><BotIcon className="mr-2 h-5 w-5 text-primary/80" /> 3. Configure Bot & Activate</h3>
            <div>
                <Label htmlFor="targetSymbols">Target Symbols (comma-separated)</Label>
                <Input id="targetSymbols" name="targetSymbols" value={formData.targetSymbols} onChange={handleInputChange} placeholder="e.g., BTCUSDT, ETHUSDT" disabled={isSaving} className="mt-1" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label htmlFor="emaShortPeriod">EMA Short</Label><Input id="emaShortPeriod" name="emaShortPeriod" type="number" value={formData.emaShortPeriod} onChange={handleInputChange} placeholder="e.g., 9" disabled={isSaving} className="mt-1" /></div>
                <div><Label htmlFor="emaMediumPeriod">EMA Medium</Label><Input id="emaMediumPeriod" name="emaMediumPeriod" type="number" value={formData.emaMediumPeriod} onChange={handleInputChange} placeholder="e.g., 21" disabled={isSaving} className="mt-1" /></div>
                <div><Label htmlFor="emaLongPeriod">EMA Long</Label><Input id="emaLongPeriod" name="emaLongPeriod" type="number" value={formData.emaLongPeriod} onChange={handleInputChange} placeholder="e.g., 55" disabled={isSaving} className="mt-1" /></div>
            </div>
            <div>
                <Label htmlFor="atrPeriod">ATR Period (for SL/TP)</Label>
                <Input id="atrPeriod" name="atrPeriod" type="number" value={formData.atrPeriod} onChange={handleInputChange} placeholder="e.g., 14" disabled={isSaving} className="mt-1" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="stopLossMultiplier">Stop Loss Multiplier (ATR-based)</Label>
                    <Input id="stopLossMultiplier" name="stopLossMultiplier" type="number" step="0.1" value={formData.stopLossMultiplier} onChange={handleInputChange} placeholder="e.g., 1.5 (Required for ATR strategy)" disabled={isSaving} className="mt-1" />
                </div>
                <div>
                    <Label htmlFor="takeProfitMultiplier">Take Profit Multiplier (ATR-based)</Label>
                    <Input id="takeProfitMultiplier" name="takeProfitMultiplier" type="number" step="0.1" value={formData.takeProfitMultiplier} onChange={handleInputChange} placeholder="e.g., 3 (Required for ATR strategy)" disabled={isSaving} className="mt-1" />
                </div>
            </div>
             <div>
                <Label htmlFor="tradingEnabled" className="flex items-center justify-between">
                <span>Trading Enabled (Activate Bot)</span>
                <Switch id="tradingEnabled" name="tradingEnabled" checked={formData.tradingEnabled} onCheckedChange={handleSwitchChange} disabled={isSaving} />
                </Label>
                 <p className="text-xs text-muted-foreground mt-1">This will enable/disable the bot based on the saved configuration.</p>
            </div>
            <Button type="submit" disabled={isSaving || isValidating || isSuggesting} className="w-full text-base py-3">
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              Save Strategy & Bot Configuration
            </Button>
          </section>
        </form>
      </CardContent>
    </Card>
  );
}
