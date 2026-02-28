import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ActivityFeed } from "@/components/sections/activity-feed";
import type { ActivitySummary } from "@/lib/types/activity-summary";

const mockSummary: ActivitySummary = {
  id: "abc-123",
  weekEnding: "2026-02-22",
  headline: "Shipped activity feed UI",
  highlights: ["Built public API endpoint", "Integrated into project card"],
  metrics: { prsShipped: 3, testsPassing: 42, featuresDelivered: 2 },
  tags: ["frontend", "api"],
  createdAt: "2026-02-22T12:00:00.000Z",
};

function mockFetch(data: ActivitySummary[]) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data }),
  } as unknown as Response);
}

describe("ActivityFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading state initially", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<ActivityFeed />);
    expect(screen.getByLabelText("Loading activity")).toBeInTheDocument();
  });

  it("renders activity summaries after fetch", async () => {
    mockFetch([mockSummary]);
    render(<ActivityFeed />);
    await waitFor(() => {
      expect(screen.getByText("Shipped activity feed UI")).toBeInTheDocument();
    });
    expect(screen.getByText("Built public API endpoint")).toBeInTheDocument();
    expect(screen.getByText("Week of Feb 22, 2026")).toBeInTheDocument();
  });

  it("renders empty state when no data", async () => {
    mockFetch([]);
    render(<ActivityFeed />);
    await waitFor(() => {
      expect(screen.getByText("No activity data yet.")).toBeInTheDocument();
    });
  });

  it("handles fetch errors gracefully", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    render(<ActivityFeed />);
    await waitFor(() => {
      expect(screen.getByText("No activity data yet.")).toBeInTheDocument();
    });
  });

  it("renders metrics correctly", async () => {
    mockFetch([mockSummary]);
    render(<ActivityFeed />);
    await waitFor(() => {
      expect(screen.getByText("3 PRs · 2 features")).toBeInTheDocument();
    });
  });

  it("renders tags as badges", async () => {
    mockFetch([mockSummary]);
    render(<ActivityFeed />);
    await waitFor(() => {
      expect(screen.getByText("frontend")).toBeInTheDocument();
      expect(screen.getByText("api")).toBeInTheDocument();
    });
  });

  it("renders multiple summaries", async () => {
    const second: ActivitySummary = {
      ...mockSummary,
      id: "def-456",
      weekEnding: "2026-02-15",
      headline: "Previous week work",
    };
    mockFetch([mockSummary, second]);
    render(<ActivityFeed />);
    await waitFor(() => {
      expect(screen.getByText("Shipped activity feed UI")).toBeInTheDocument();
      expect(screen.getByText("Previous week work")).toBeInTheDocument();
    });
  });
});
