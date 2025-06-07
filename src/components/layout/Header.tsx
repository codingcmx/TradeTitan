import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Bot } from 'lucide-react';
import { getBotConfiguration } from '@/lib/firestoreService';
import type { BotConfig } from '@/types';

export async function Header() {
  let isBotOnline = false;
  let botStatusText = "Offline";
  let botStatusColor = "text-red-400"; // Default to Offline color

  try {
    // Fetch the latest bot configuration on the server
    const config: BotConfig = await getBotConfiguration();
    // Determine bot status based on the tradingEnabled flag
    // Boolean(undefined) is false, Boolean(null) is false, Boolean(false) is false, Boolean(true) is true
    isBotOnline = Boolean(config.tradingEnabled); 
    
    if (isBotOnline) {
      botStatusText = "Online";
      botStatusColor = "text-green-400";
    }
    // If config.tradingEnabled is false, null, or undefined,
    // it defaults to "Offline" and "text-red-400" as initialized.
  } catch (error) {
    console.error("Error fetching bot status for header:", error);
    // Keep default offline status if there's an error during fetch
    isBotOnline = false; // Ensure it's marked offline on error
    botStatusText = "Offline";
    botStatusColor = "text-red-400";
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <Link href="/" aria-label="Homepage">
          <Logo />
        </Link>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Bot className="mr-2 h-4 w-4" />
            Bot Status: <span className={`ml-1 font-semibold ${botStatusColor}`}>{botStatusText}</span>
          </Button>
          {/* Add more header items if needed, e.g., user profile */}
        </div>
      </div>
    </header>
  );
}
