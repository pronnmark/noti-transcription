'use client';

import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface UnibodyCardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  children: React.ReactNode;
}

/**
 * Unibody card component following Design Buzz philosophy
 * 
 * Design Principles Applied:
 * - Purposeful Existence: Single component, no wrapper hierarchy
 * - Sculpted Form: Feels like a unified, solid object
 * - Effortless Sophistication: Hides complexity behind simple interface
 * - Honesty in Materials: Pure use of shadow and space for depth
 * - Clarity Through Hierarchy: Clean, purposeful structure
 */
const UnibodyCard = forwardRef<HTMLDivElement, UnibodyCardProps>(
  ({ className, interactive = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base unibody construction - monolithic form with Design Buzz spacing
          "bg-white rounded-xl buzz-content-spacing",
          
          // Honest materials - Design Buzz soft shadows for subtle elevation
          "buzz-shadow-sm border border-border",
          
          // Interactive states - effortless sophistication
          interactive && [
            "hover:buzz-shadow-md hover:border-border/60",
            "active:scale-[0.99]",
            "transition-all duration-200 ease-out",
            "cursor-pointer touch-manipulation",
          ],
          
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

UnibodyCard.displayName = 'UnibodyCard';

export { UnibodyCard };