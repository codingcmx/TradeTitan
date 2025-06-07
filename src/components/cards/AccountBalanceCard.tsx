'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet } from 'lucide-react';
import { getAccountBalance } from '@/ai/flows/account-flow';
import type { AccountBalanceOutput } from '@/ai/flows/account-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export function AccountBalanceCard() {
  const [balance, setBalance] = useState<AccountBalanceOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBalance() {
      try {
        setLoading(true);
        setError(null);
        const result = await getAccountBalance();
        setBalance(result);
      } catch (err: any) {
        console.error("Error fetching account balance:", err);
        setError(err.message || "Failed to load account balance. See console for details.");
      } finally {
        setLoading(false);
      }
    }
    fetchBalance();
  }, []);

  return (
    <Card className="shadow-lg hover:shadow-primary/20 transition-shadow duration-300 col-span-1 md:col-span-1 lg:col-span-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Account Balance (Futures)</CardTitle>
        <Wallet className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full mt-3" /> 
          </>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : balance ? (
          <>
            <div className="text-3xl font-bold text-foreground">
              ${balance.usdtBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Available USDT Balance
            </p>
            <div className="text-lg font-semibold text-foreground/80 mt-2">
              Total Equity: ${balance.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
           
          </>
        ) : (
          <p className="text-muted-foreground">No balance data available.</p>
        )}
      </CardContent>
    </Card>
  );
}
