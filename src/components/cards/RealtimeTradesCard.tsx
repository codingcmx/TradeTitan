
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Trade } from '@/types';
import { ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { db } from '@/lib/firebase'; 
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';

export function RealtimeTradesCard() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setError("Firebase is not configured. Real-time updates are disabled.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const tradesRef = collection(db, 'trades');
    // Query for trades that are 'OPEN' or recently closed (e.g., within the last hour)
    // Adjust the time window as needed. For truly "live", 'OPEN' status is key.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const q = query(
      tradesRef, 
      where('status', '==', 'OPEN'), // Primarily show open trades
      // You could add another query for recently closed ones if desired, but that might need multiple queries or different logic.
      // For simplicity, focusing on 'OPEN' trades for "Real-time".
      orderBy('timestampOpen', 'desc'), 
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const newTrades: Trade[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        newTrades.push({ 
          id: doc.id, 
          ...data,
          timestampOpen: (data.timestampOpen as Timestamp)?.toDate ? (data.timestampOpen as Timestamp).toDate() : new Date(data.timestampOpen),
          timestampClose: (data.timestampClose as Timestamp)?.toDate ? (data.timestampClose as Timestamp).toDate() : data.timestampClose ? new Date(data.timestampClose) : undefined,
        } as Trade);
      });
      setTrades(newTrades);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching real-time trades:", err);
      setError("Failed to load real-time trades. See console for details.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getStatusBadgeVariant = (status: Trade['status']) => {
    if (status === 'OPEN') return 'default'; 
    if (status.includes('WIN')) return 'secondary'; 
    if (status.includes('LOSS')) return 'destructive'; 
    return 'outline';
  };

  const formatPrice = (price: number | undefined) => price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-';
  const formatTime = (date: Date | undefined) => date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) || '-';

  if (error && !loading) { // Only show main error if not initially loading
    return (
      <Card>
        <CardHeader>
          <CardTitle>Real-time Trades</CardTitle>
          <CardDescription>Live trades from your bot.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-64 text-destructive">
          <AlertTriangle className="w-12 h-12 mb-4" />
          <p className="text-lg font-semibold">Error Loading Trades</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Real-time Trades</CardTitle>
        <CardDescription>Live market activity from your strategy.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-[300px] pr-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : trades.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">No live trades at the moment.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Entry Price</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell className="font-medium">{trade.symbol}</TableCell>
                    <TableCell>
                      <Badge variant={trade.type === 'BUY' ? 'default' : 'secondary'} className={trade.type === 'BUY' ? 'bg-green-500/20 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-red-500/20 text-red-700 dark:bg-red-500/10 dark:text-red-400'}>
                        {trade.type === 'BUY' ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                        {trade.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatPrice(trade.entryPrice)}</TableCell>
                    <TableCell>{trade.quantity}</TableCell>
                    <TableCell>{formatTime(trade.timestampOpen)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(trade.status)}>{trade.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
