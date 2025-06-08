
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
import {
  suggestBotConfigParameters,
  type StrategyConfigSuggesterInput,
  type StrategyConfigSuggesterOutput,
} from '@/ai/flows/strategy-config-suggester-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Lightbulb, Loader2, Sparkles } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function AiConfigSuggesterCard() {
  const [strategyDescription, setStrategyDescription] = useState('');
  const [capital, setCapital] = useState('1000');
  const [aiResponse, setAiResponse] = useState<StrategyConfigSuggesterOutput | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAiResponse(null);

    if (!strategyDescription.trim()) {
      setError('Please provide a strategy description.');
      toast({
        title: 'Input Missing',
        description: 'Strategy description is required.',
        variant: 'destructive',
      });
      return;
    }
    const parsedCapital = parseFloat(capital);
    if (isNaN(parsedCapital) || parsedCapital <= 0) {
      setError('Please enter a valid positive number for capital.');
      toast({
        title: 'Input Error',
        description: 'Capital must be a positive number.',
        variant: 'destructive',
      });
      return;
    }

    const input: StrategyConfigSuggesterInput = {
      strategyDescription,
      capital: parsedCapital,
    };

    startTransition(async () => {
      try {
        const result = await suggestBotConfigParameters(input);
        setAiResponse(result);
        if (result.warnings && result.warnings.length > 0) {
            toast({
                title: "AI Suggestions Generated (with warnings)",
                description: "Review warnings and suggestions carefully.",
                variant: "default"
            });
        } else {
            toast({
                title: "AI Suggestions Generated",
                description: "Review the suggestions below.",
            });
        }
      } catch (err: any) {
        console.error('Error getting AI config suggestions:', err);
        const errorMessage = err.message || 'Failed to get suggestions from AI.';
        setError(errorMessage);
        toast({
          title: 'AI Error',
          description: errorMessage,
          variant: 'destructive',
        });
        setAiResponse(null);
      }
    });
  };

  return (
    <Card className="shadow-lg mt-8">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Sparkles className="mr-2 h-6 w-6 text-primary" />
          AI Bot Configuration Suggester
        </CardTitle>
        <CardDescription>
          Describe your strategy and budget. The AI will suggest parameters for the Bot Configuration card.
          You will need to manually enter these suggestions into the card above.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="strategyDescription">Strategy Description</Label>
            <Textarea
              id="strategyDescription"
              value={strategyDescription}
              onChange={(e) => setStrategyDescription(e.target.value)}
              placeholder="e.g., I want to trade BTCUSDT and ETHUSDT. Use a 9 EMA and 21 EMA crossover. For volatility, use ATR 14. My entries are on crossover, exits are ATR-based..."
              className="mt-1 h-32"
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="capital">Your Trading Capital ($)</Label>
            <Input
              id="capital"
              name="capital"
              type="number"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              placeholder="e.g., 1000"
              disabled={isPending}
              className="mt-1"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Get AI Suggestions
          </Button>
        </form>

        {aiResponse && (
          <div className="mt-8 space-y-6 p-4 border rounded-md bg-muted/30">
            <h3 className="text-xl font-semibold text-primary">AI Suggestions & Analysis:</h3>
            
            <Separator />
            <div>
              <h4 className="font-semibold text-lg mb-2">Summary:</h4>
              <p className="text-sm whitespace-pre-wrap">{aiResponse.summary}</p>
            </div>

            {Object.keys(aiResponse.suggestions).length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold text-lg mb-2">Suggested Parameters:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {aiResponse.suggestions.targetSymbols && aiResponse.suggestions.targetSymbols.length > 0 && (
                      <li><strong>Target Symbols:</strong> {aiResponse.suggestions.targetSymbols.join(', ')}</li>
                    )}
                    {aiResponse.suggestions.emaShortPeriod !== undefined && (
                      <li><strong>EMA Short Period:</strong> {aiResponse.suggestions.emaShortPeriod}</li>
                    )}
                    {aiResponse.suggestions.emaMediumPeriod !== undefined && (
                      <li><strong>EMA Medium Period:</strong> {aiResponse.suggestions.emaMediumPeriod}</li>
                    )}
                    {aiResponse.suggestions.emaLongPeriod !== undefined && (
                      <li><strong>EMA Long Period:</strong> {aiResponse.suggestions.emaLongPeriod}</li>
                    )}
                    {aiResponse.suggestions.atrPeriod !== undefined && (
                      <li><strong>ATR Period:</strong> {aiResponse.suggestions.atrPeriod}</li>
                    )}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Remember to manually enter these suggestions into the &quot;Bot Configuration&quot; card above and then save it.
                  </p>
                </div>
              </>
            )}

            {aiResponse.aiAssumptions && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold text-lg mb-2">AI Assumptions:</h4>
                  <p className="text-sm whitespace-pre-wrap">{aiResponse.aiAssumptions}</p>
                </div>
              </>
            )}

            {aiResponse.warnings && aiResponse.warnings.length > 0 && (
              <>
                <Separator />
                 <Alert variant="default" className="bg-amber-500/10 border-amber-500/30">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <AlertTitle className="text-amber-700 font-semibold">Warnings & Notes</AlertTitle>
                    <AlertDescription>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                        {aiResponse.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                        ))}
                        </ul>
                    </AlertDescription>
                </Alert>
              </>
            )}
             <Separator />
             <Alert variant="default" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Important Reminder</AlertTitle>
                <AlertDescription>
                These are AI-generated suggestions. Always review them carefully. You are responsible for the final configuration of your trading bot, especially risk management parameters like stop-loss and take-profit settings, which you need to set based on your capital and risk tolerance.
                </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
