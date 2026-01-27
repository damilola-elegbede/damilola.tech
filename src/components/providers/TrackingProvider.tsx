'use client';

import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/audit-client';

interface TrackingProviderProps {
  children: React.ReactNode;
}

export function TrackingProvider({ children }: TrackingProviderProps) {
  const hasTrackedPageView = useRef(false);

  useEffect(() => {
    // Only track page view once per mount
    if (hasTrackedPageView.current) return;
    hasTrackedPageView.current = true;

    // Fire page_view event with traffic source
    trackEvent('page_view', {
      includeTrafficSource: true,
    });
  }, []);

  return <>{children}</>;
}
