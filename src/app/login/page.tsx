
'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginAction } from './actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, KeyRound, Loader2 } from 'lucide-react';
import { Logo } from '@/components/Logo';

export default function LoginPage() {
  const router = useRouter(); // Keep router in case of future needs, but not for primary redirect
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(searchParams.get('error'));
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await loginAction(password);
      if (result?.error) {
        setError(result.error);
      }
      // If loginAction is successful, it now handles the redirect.
      // If it returns an error object, we display the error.
      // No explicit client-side router.push('/') needed here if server action redirects.
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8">
        <Logo />
      </div>
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <KeyRound className="mr-2 h-6 w-6 text-primary" /> Access Required
          </CardTitle>
          <CardDescription>
            Please enter the password to access the TradeWatch dashboard.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isPending}
                placeholder="Enter your password"
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Login Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              Unlock
            </Button>
          </CardFooter>
        </form>
      </Card>
      <p className="mt-8 text-xs text-muted-foreground">
        TradeWatch Dashboard &copy; {new Date().getFullYear()}
      </p>
    </div>
  );
}
