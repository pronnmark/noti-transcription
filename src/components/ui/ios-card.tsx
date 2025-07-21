'use client';

import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface IOSCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive';
  children: React.ReactNode;
}

/**
 * iOS-native card component following Design Buzz philosophy
 * - Seamless unibody construction without borders
 * - Multi-layered shadows for subtle depth
 * - Chamfered edges with generous spacing
 * - Honest use of light and space as materials
 */
const IOSCard = forwardRef<HTMLDivElement, IOSCardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base unibody construction - no borders, only space and shadow
          "bg-white rounded-2xl overflow-hidden",
          "transition-all duration-300 ease-out",
          
          // Variant-specific styling following iOS design patterns
          variant === 'default' && [
            "shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
          ],
          variant === 'elevated' && [
            "shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.1)]",
          ],
          variant === 'interactive' && [
            "shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
            "hover:shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.1)]",
            "active:scale-[0.98] active:shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
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

IOSCard.displayName = 'IOSCard';

/**
 * iOS-native card content with generous spacing
 * Following iOS HIG spacing principles
 */
const IOSCardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Generous iOS-style padding following 8pt grid system
      "px-5 py-4",
      className
    )}
    {...props}
  />
));

IOSCardContent.displayName = 'IOSCardContent';

/**
 * iOS-native card header with proper typography hierarchy
 */
const IOSCardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // iOS system typography with generous spacing
      "px-5 pt-5 pb-2",
      className
    )}
    {...props}
  />
));

IOSCardHeader.displayName = 'IOSCardHeader';

/**
 * iOS-native card title following SF Pro typography scale
 */
const IOSCardTitle = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      // iOS Large Title style - clear hierarchy
      "text-lg font-semibold leading-tight tracking-tight text-gray-900",
      className
    )}
    {...props}
  />
));

IOSCardTitle.displayName = 'IOSCardTitle';

/**
 * iOS-native card description with muted styling
 */
const IOSCardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      // iOS secondary text style - clear but understated
      "text-sm font-normal leading-relaxed text-gray-600 mt-1",
      className
    )}
    {...props}
  />
));

IOSCardDescription.displayName = 'IOSCardDescription';

/**
 * iOS-native card footer for actions and metadata
 */
const IOSCardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Consistent footer styling with subtle separation
      "px-5 pb-5 pt-2",
      className
    )}
    {...props}
  />
));

IOSCardFooter.displayName = 'IOSCardFooter';

export {
  IOSCard,
  IOSCardContent,
  IOSCardHeader,
  IOSCardTitle,
  IOSCardDescription,
  IOSCardFooter,
};