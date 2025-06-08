
'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getStrategySuggestions, type StrategyAssistantInput, type StrategyAssistantOutput } from '@/ai/flows/strategy-assistant-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Lightbulb, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface FormData {
  capital: string;
  tradeSize: string;
  takeProfitValue: string;
  stopLossValue: string;
}

export function StrategyAssistantCard() {
  const [formData, setFormData] = useState<FormData>({
    capital: '1000',
    tradeSize: '50',
    takeProfitValue: '60', // e.g., $50 margin becomes $60
    stopLossValue: '45',   // e.g., $50 margin becomes $45
  });
  const [suggestions, setSuggestions] = useState<StrategyAssistantOutput | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuggestions(null);

    const parsedInput: StrategyAssistantInput = {
      capital: parseFloat(formData.capital),
      tradeSize: parseFloat(formData.tradeSize),
      takeProfitValue: parseFloat(formData.takeProfitValue),
      stopLossValue: parseFloat(formData.stopLossValue),
    };

    if (isNaN(parsedInput.capital) || isNaN(parsedInput.tradeSize) || isNaN(parsedInput.takeProfitValue) || isNaN(parsedInput.stopLossValue)) {
      setError("All inputs must be valid numbers.");
      toast({ title: "Input Error", description: "All inputs must be valid numbers.", variant: "destructive" });
      return;
    }
    if (parsedInput.tradeSize <=0) {
        setError("Trade size must be positive.");
        toast({ title: "Input Error", description: "Trade size must be positive.", variant: "destructive" });
        return;
    }
    if (parsedInput.takeProfitValue <= parsedInput.tradeSize) {
        setError("Take profit value must be greater than trade size.");
        toast({ title: "Input Error", description: "Take profit value must be greater than trade size.", variant: "destructive" });
        return;
    }
    if (parsedInput.stopLossValue >= parsedInput.tradeSize) {
        setError("Stop loss value must be less than trade size.");
        toast({ title: "Input Error", description: "Stop loss value must be less than trade size.", variant: "destructive" });
        return;
    }
     if (parsedInput.tradeSize > parsedInput.capital) {
        setError("Trade size cannot exceed total capital.");
        toast({ title: "Input Error", description: "Trade size cannot exceed total capital.", variant: "destructive" });
        return;
    }


    startTransition(async () => {
      try {
        const result = await getStrategySuggestions(parsedInput);
        if (!result.isValidInput && result.explanation) {
            setError(result.explanation); // Display AI's validation message
            toast({ title: "Input Validation Error by AI", description: result.explanation, variant: "destructive" });
            setSuggestions(null); // Clear previous suggestions if any
        } else if (!result.isValidInput) {
            // Fallback if AI marks invalid but provides no explanation (should not happen with current prompt)
            setError("The AI determined the inputs were invalid but provided no specific reason. Please check your values.");
            toast({ title: "Input Validation Error by AI", description: "Please check your values.", variant: "destructive"});
            setSuggestions(null);
        }
         else {
            setSuggestions(result); // Set valid suggestions
            toast({ title: "AI Analysis Complete", description: "Review the AI's explanation below."});
        }
      } catch (err: any) {
        console.error("Error getting strategy suggestions:", err);
        const errorMessage = err.message || "Failed to get suggestions from AI.";
        setError(errorMessage);
        toast({ title: "AI Error", description: errorMessage, variant: "destructive" });
        setSuggestions(null);
      }
    });
  };

  return (
    <Card className="shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Lightbulb className="mr-2 h-6 w-6 text-primary" />
          AI Trade Value Assistant
        </CardTitle>
        <CardDescription>
          Input your capital, trade size, and target take profit/stop loss values. The AI will explain implications like percentage change on margin and conceptual leverage. This tool is for analysis and does not configure the bot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="capital">Total Capital ($)</Label>
              <Input id="capital" name="capital" type="number" value={formData.capital} onChange={handleInputChange} placeholder="e.g., 1000" disabled={isPending} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="tradeSize">Margin per Trade ($)</Label>
              <Input id="tradeSize" name="tradeSize" type="number" value={formData.tradeSize} onChange={handleInputChange} placeholder="e.g., 50" disabled={isPending} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="takeProfitValue">Take Profit At ($ value of margin)</Label>
              <Input id="takeProfitValue" name="takeProfitValue" type="number" value={formData.takeProfitValue} onChange={handleInputChange} placeholder="e.g., 60" disabled={isPending} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">If margin is $50, this is the target value, e.g., $60.</p>
            </div>
            <div>
              <Label htmlFor="stopLossValue">Stop Loss At ($ value of margin)</Label>
              <Input id="stopLossValue" name="stopLossValue" type="number" value={formData.stopLossValue} onChange={handleInputChange} placeholder="e.g., 45" disabled={isPending} className="mt-1" />
               <p className="text-xs text-muted-foreground mt-1">If margin is $50, this is the SL value, e.g., $45.</p>
            </div>
          </div>
          {error && !isPending && ( // Only show error if not pending and error exists
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
            Get AI Analysis
          </Button>
        </form>

        {suggestions && suggestions.isValidInput && (
          <div className="mt-6 space-y-4 p-4 border rounded-md bg-muted/30">
            <h3 className="text-lg font-semibold text-primary">AI Analysis:</h3>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <p><strong>Target Profit per Trade:</strong> ${suggestions.profitAmount.toFixed(2)}</p>
              <p><strong>Target Loss per Trade:</strong> ${suggestions.lossAmount.toFixed(2)}</p>
              <p><strong>Risk/Reward Ratio:</strong> {suggestions.riskRewardRatio}</p>
              <p><strong>Take Profit on Margin:</strong> {suggestions.takeProfitPercentageOnMargin.toFixed(2)}%</p>
              <p><strong>Stop Loss on Margin:</strong> {suggestions.stopLossPercentageOnMargin.toFixed(2)}%</p>
            </div>
            <Separator />
            <div className="prose prose-sm dark:prose-invert max-w-none">
                <h4 className="font-semibold">Explanation & Guidance:</h4>
                <p className="whitespace-pre-wrap">{suggestions.explanation}</p>
            </div>
          </div>
        )}
         {/* This section is redundant if error state handles AI's isValidInput=false message */}
         {/* suggestions && !suggestions.isValidInput && suggestions.explanation && (
            <Alert variant="destructive" className="mt-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>AI Suggestion Error</AlertTitle>
              <AlertDescription>{suggestions.explanation}</AlertDescription>
            </Alert>
         ) */}
      </CardContent>
    </Card>
  );
}
