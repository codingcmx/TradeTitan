
'use client';

import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Bot, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getBotConfiguration } from '@/lib/firestoreService';
import type { BotConfig } from '@/types';

export function Header() {
  const [botStatusText, setBotStatusText] = useState<string>("Checking...");
  const [botStatusColor, setBotStatusColor] = useState<string>("text-muted-foreground");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchStatus() {
      setIsLoading(true);
      try {
        const config: BotConfig = await getBotConfiguration();
        const isBotOnline = Boolean(config.tradingEnabled);
        
        if (isBotOnline) {
          setBotStatusText("Online");
          setBotStatusColor("text-green-400");
        } else {
          setBotStatusText("Offline");
          setBotStatusColor("text-red-400");
        }
      } catch (error) {
        console.error("Error fetching bot status for header:", error);
        setBotStatusText("Error");
        setBotStatusColor("text-red-400");
      } finally {
        setIsLoading(false);
      }
    }
    fetchStatus();
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <Link href="/" aria-label="Homepage">
          <Logo />
        </Link>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Bot className="mr-2 h-4 w-4" />
            )}
            Bot Status: <span className={`ml-1 font-semibold ${botStatusColor}`}>{botStatusText}</span>
          </Button>
          {/* Add more header items if needed, e.g., user profile */}
        </div>
      </div>
    </header>
  );
}
