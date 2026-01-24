'use client';

import { useEffect, useState, useCallback } from 'react';
import { AuditLogTable } from '@/components/admin/AuditLogTable';
import { PageNavigation } from '@/components/admin/PageNavigation';

interface AuditEvent {
  id: string;
  pathname: string;
  eventType: string;
  environment: string;
  date: string;
  timestamp: string;
  size: number;
  url: string;
}

const PAGE_SIZE = 30;

const eventTypes = [
  'page_view',
  'section_view',
  'chat_opened',
  'chat_message_sent',
  'fit_assessment_started',
  'fit_assessment_completed',
  'fit_assessment_download',
  'external_link_click',
  'admin_login_success',
  'admin_login_failure',
  'admin_logout',
  'admin_chat_viewed',
  'admin_assessment_viewed',
  'admin_audit_accessed',
];

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null]); // Index 0 = page 1 cursor (null for first page)
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const fetchPage = useCallback(async (pageNum: number, cursorForPage: string | null) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set('limit', PAGE_SIZE.toString());
      if (cursorForPage) params.set('cursor', cursorForPage);
      if (selectedType) params.set('eventType', selectedType);
      if (selectedDate) params.set('date', selectedDate);

      const res = await fetch(`/api/admin/audit?${params}`);
      if (!res.ok) throw new Error('Failed to fetch events');

      const data = await res.json();
      setEvents(data.events);
      setHasMore(data.hasMore);
      setCurrentPage(pageNum);

      // Store cursor for next page if we have more
      if (data.hasMore && data.cursor) {
        setCursorHistory((prev) => {
          const newHistory = [...prev];
          // Ensure we have slot for current page's next cursor
          while (newHistory.length <= pageNum) {
            newHistory.push(null);
          }
          newHistory[pageNum] = data.cursor;
          return newHistory;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [selectedType, selectedDate]);

  const handleNext = useCallback(() => {
    if (hasMore && cursorHistory[currentPage]) {
      fetchPage(currentPage + 1, cursorHistory[currentPage]);
    }
  }, [hasMore, currentPage, cursorHistory, fetchPage]);

  const handlePrev = useCallback(() => {
    if (currentPage > 1) {
      fetchPage(currentPage - 1, cursorHistory[currentPage - 2]);
    }
  }, [currentPage, cursorHistory, fetchPage]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCursorHistory([null]);
    setCurrentPage(1);
    fetchPage(1, null);
  }, [selectedType, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = () => {
    setCursorHistory([null]);
    setCurrentPage(1);
    setEvents([]);
  };

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-text)]">Audit Log</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-sm text-[var(--color-text-muted)]">Event Type</label>
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              handleFilterChange();
            }}
            className="mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)]"
          >
            <option value="">All Types</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-[var(--color-text-muted)]">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              handleFilterChange();
            }}
            className="mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)]"
          />
        </div>
        {(selectedType || selectedDate) && (
          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedType('');
                setSelectedDate('');
                handleFilterChange();
              }}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      <AuditLogTable events={events} isLoading={isLoading && events.length === 0} />
      <PageNavigation
        currentPage={currentPage}
        hasNext={hasMore}
        hasPrev={currentPage > 1}
        onNext={handleNext}
        onPrev={handlePrev}
        isLoading={isLoading}
      />
    </div>
  );
}
