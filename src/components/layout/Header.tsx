
'use client';

import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Bot, Loader2, LogOut } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { getBotConfiguration } from '@/lib/firestoreService';
import type { BotConfig } from '@/types';
import { logoutAction } from '@/app/login/actions'; // Import the logout action
import { useRouter } from 'next/navigation';

export function Header() {
  const [botStatusText, setBotStatusText] = useState<string>("Checking...");
  const [botStatusColor, setBotStatusColor] = useState<string>("text-muted-foreground");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const router = useRouter();

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

  const handleLogout = async () => {
    startLogoutTransition(async () => {
      await logoutAction();
      // The middleware should handle redirecting to /login,
      // but an explicit push can be a fallback or for immediate UI update.
      router.push('/login'); 
    });
  };

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
          <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
