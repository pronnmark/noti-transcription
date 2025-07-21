import { useEffect, useState, useCallback } from 'react';

export function useMediaQuery(query: string): boolean {
  // Initialize with a function to avoid hydration mismatches
  const [matches, setMatches] = useState(() => {
    // Always return false on server-side
    if (typeof window === 'undefined') {
      return false;
    }
    // Return false initially to prevent hydration mismatch
    return false;
  });

  const [mounted, setMounted] = useState(false);

  const updateMatches = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const media = window.matchMedia(query);
      setMatches(media.matches);
    } catch (error) {
      console.warn('Media query error:', error);
      setMatches(false);
    }
  }, [query]);

  useEffect(() => {
    setMounted(true);

    // Check if window is available (client-side)
    if (typeof window === 'undefined') {
      return;
    }

    let media: MediaQueryList | null = null;

    try {
      media = window.matchMedia(query);

      // Set the initial value after mount
      setMatches(media.matches);

      // Create listener
      const listener = (event: MediaQueryListEvent) => {
        setMatches(event.matches);
      };

      // Add listener with proper error handling
      if (media.addEventListener) {
        media.addEventListener('change', listener);
      } else {
        // Fallback for older browsers
        media.addListener(listener);
      }

      // Cleanup
      return () => {
        if (!media) return;

        try {
          if (media.removeEventListener) {
            media.removeEventListener('change', listener);
          } else {
            // Fallback for older browsers
            media.removeListener(listener);
          }
        } catch (error) {
          console.warn('Error removing media query listener:', error);
        }
      };
    } catch (error) {
      console.warn('Error setting up media query:', error);
      setMatches(false);
    }
  }, [query]);

  // Only return matches after component has mounted
  // This prevents hydration mismatches
  return mounted ? matches : false;
}
