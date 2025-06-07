import type { SVGProps } from 'react';
import { Zap } from 'lucide-react';

interface LogoProps extends SVGProps<SVGSVGElement> {
  iconOnly?: boolean;
}

export function Logo({ iconOnly = false, className, ...props }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      <Zap className="h-8 w-8 text-primary" />
      {!iconOnly && (
        <span className="text-2xl font-semibold text-foreground font-headline">
          TradeWatch
        </span>
      )}
    </div>
  );
}
