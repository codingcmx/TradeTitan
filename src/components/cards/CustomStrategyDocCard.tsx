
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { CustomStrategyDoc } from '@/types';
import { getCustomStrategyDoc } from '@/lib/firestoreService';
import { saveCustomStrategyDocAction } from '@/app/actions';
import { validateStrategyConsistency, type StrategyValidationOutput } from '@/ai/flows/strategy-validator-flow';
import { Loader2, Save, FileText, Wand2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

const initialFormState: CustomStrategyDoc = {
  pineScript: '',
  explanation: '',
};

export function CustomStrategyDocCard() {
  const [strategyDoc, setStrategyDoc] = useState<CustomStrategyDoc>(initialFormState);
  const [isLoadingDoc, setIsLoadingDoc] = useState(true);
  const [isSaving, startSaveTransition] = useTransition();
  const [isValiding, startValidationTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<StrategyValidationOutput | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchDoc() {
      setIsLoadingDoc(true);
      setError(null);
      try {
        const fetchedDoc = await getCustomStrategyDoc();
        setStrategyDoc(fetchedDoc || initialFormState);
      } catch (err: any) {
        console.error("Error fetching custom strategy doc:", err);
        setError(err.message || "Failed to load strategy document.");
      } finally {
        setIsLoadingDoc(false);
      }
    }
    fetchDoc();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setStrategyDoc(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startSaveTransition(async () => {
      const formData = new FormData(event.currentTarget);
      const result = await saveCustomStrategyDocAction(formData);
      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        if (result.updatedDoc) {
          setStrategyDoc(result.updatedDoc);
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

  const handleValidate = async () => {
    setError(null);
    setValidationResult(null);
    if (!strategyDoc.pineScript?.trim() || !strategyDoc.explanation?.trim()) {
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
          pineScript: strategyDoc.pineScript || '',
          explanation: strategyDoc.explanation || '',
        });
        setValidationResult(result);
        if (result.isConsistent) {
            toast({ title: "Validation Complete", description: "Strategy and explanation appear consistent." });
        } else {
            toast({ title: "Validation Issues Found", description: "Mismatches detected. See details.", variant: "default" });
        }
      } catch (err: any) {
        console.error("Error validating strategy:", err);
        setError(err.message || "Failed to validate strategy with AI.");
        toast({
          title: 'Validation Error',
          description: err.message || "An AI error occurred during validation.",
          variant: 'destructive',
        });
      }
    });
  };
  
  if (isLoadingDoc) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><FileText className="mr-2 h-6 w-6 text-primary" /> Custom Strategy Document</CardTitle>
          <CardDescription>Store your Pine Script and its explanation. Validate with AI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="block h-4 w-1/4 bg-muted rounded animate-pulse" />
            <Textarea className="h-32 bg-muted rounded animate-pulse" disabled />
          </div>
          <div className="space-y-1">
            <Label className="block h-4 w-1/4 bg-muted rounded animate-pulse" />
            <Textarea className="h-32 bg-muted rounded animate-pulse" disabled />
          </div>
          <Button disabled className="w-full">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><FileText className="mr-2 h-6 w-6 text-primary" /> Custom Strategy Document</CardTitle>
        <CardDescription>
          Store your Pine Script and its natural language explanation. Use the AI validator to check for inconsistencies.
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
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <Label htmlFor="pineScript">Pine Script</Label>
            <Textarea
              id="pineScript"
              name="pineScript"
              value={strategyDoc.pineScript || ''}
              onChange={handleInputChange}
              placeholder="Paste your Pine Script code here..."
              className="mt-1 h-60 font-mono text-sm"
              disabled={isSaving || isValiding}
            />
          </div>
          <div>
            <Label htmlFor="explanation">Strategy Explanation</Label>
            <Textarea
              id="explanation"
              name="explanation"
              value={strategyDoc.explanation || ''}
              onChange={handleInputChange}
              placeholder="Explain how your strategy works, its entry/exit conditions, risk management, etc."
              className="mt-1 h-40"
              disabled={isSaving || isValiding}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button type="submit" disabled={isSaving || isLoadingDoc || isValiding} className="flex-1">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Document
            </Button>
            <Button type="button" onClick={handleValidate} variant="outline" disabled={isValiding || isLoadingDoc || isSaving || !strategyDoc.pineScript?.trim() || !strategyDoc.explanation?.trim()} className="flex-1">
              {isValiding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Validate with AI
            </Button>
          </div>
        </form>

        {validationResult && (
          <div className="mt-6 space-y-3">
            <Separator />
            <h3 className="text-lg font-semibold flex items-center">
              {validationResult.isConsistent ? 
                <CheckCircle2 className="mr-2 h-5 w-5 text-green-500" /> : 
                <AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />
              }
              AI Validation Feedback:
            </h3>
             <Alert variant={validationResult.isConsistent ? "default" : "destructive"} className={validationResult.isConsistent ? "bg-green-500/10 border-green-500/30" : "bg-yellow-500/10 border-yellow-500/30"}>
              <AlertTitle>{validationResult.isConsistent ? "Consistent" : "Potential Mismatches Found"}</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap text-sm">
                {validationResult.feedback}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
