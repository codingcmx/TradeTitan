import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Trade } from '@/types';
import { getTradeHistory } from '@/lib/firestoreService';
import { ArrowUpRight, ArrowDownRight, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';

export async function TradeHistoryCard() {
  const trades: Trade[] = await getTradeHistory(50); // Fetch last 50 trades

  const getStatusBadgeVariant = (status: Trade['status']) => {
    if (status === 'OPEN') return 'default';
    if (status.includes('WIN')) return 'secondary'; // Will be styled green by theme
    if (status.includes('LOSS')) return 'destructive';
    return 'outline';
  };

  const getStatusIcon = (status: Trade['status']) => {
    if (status.includes('WIN')) return <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />;
    if (status.includes('LOSS')) return <XCircle className="h-4 w-4 mr-1 text-red-500" />;
    if (status.includes('NEUTRAL')) return <MinusCircle className="h-4 w-4 mr-1 text-yellow-500" />;
    return null;
  }

  const formatDateTime = (date: Date | undefined) => date ? date.toLocaleString() : '-';
  const formatPrice = (price: number | undefined) => price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-';
  const formatPnl = (pnl: number | undefined) => {
    if (pnl === undefined || pnl === null) return '-';
    const color = pnl > 0 ? 'text-green-500' : pnl < 0 ? 'text-red-500' : 'text-muted-foreground';
    return <span className={color}>{pnl > 0 ? '+' : ''}{pnl.toFixed(2)}</span>;
  };
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Trade History</CardTitle>
        <CardDescription>Review past performance and individual trades.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        {trades.length === 0 ? (
           <div className="flex items-center justify-center h-full">
             <p className="text-muted-foreground">No trade history available.</p>
           </div>
        ) : (
        <ScrollArea className="h-[400px] pr-4"> {/* Adjust height as needed */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Exit</TableHead>
                <TableHead>PnL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Closed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => (
                <TableRow key={trade.id}>
                  <TableCell className="font-medium">{trade.symbol}</TableCell>
                  <TableCell>
                     <Badge variant={trade.type === 'BUY' ? 'default' : 'secondary'} className={`capitalize ${trade.type === 'BUY' ? 'bg-green-500/20 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-red-500/20 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>
                        {trade.type === 'BUY' ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                        {trade.type}
                      </Badge>
                  </TableCell>
                  <TableCell>{formatPrice(trade.entryPrice)}</TableCell>
                  <TableCell>{formatPrice(trade.exitPrice)}</TableCell>
                  <TableCell>{formatPnl(trade.pnl)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(trade.status)} className="flex items-center">
                      {getStatusIcon(trade.status)}
                      {trade.status.replace('CLOSED_', '')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(trade.timestampOpen)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(trade.timestampClose)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
