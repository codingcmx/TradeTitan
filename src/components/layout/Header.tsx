import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Bot } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <Link href="/" aria-label="Homepage">
          <Logo />
        </Link>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Bot className="mr-2 h-4 w-4" />
            Bot Status: <span className="ml-1 font-semibold text-green-400">Online</span>
          </Button>
          {/* Add more header items if needed, e.g., user profile */}
        </div>
      </div>
    </header>
  );
}
