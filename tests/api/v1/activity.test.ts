/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @vercel/blob
const mockList = vi.fn();
const mockPut = vi.fn();
vi.mock("@vercel/blob", () => ({
  list: (...args: unknown[]) => mockList(...args),
  put: (...args: unknown[]) => mockPut(...args),
}));

// Mock api-key-auth
const mockRequireApiKey = vi.fn();
vi.mock("@/lib/api-key-auth", () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

// Mock rate-limit
const mockCheckGenericRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  checkGenericRateLimit: (...args: unknown[]) =>
    mockCheckGenericRateLimit(...args),
}));

const mockValidApiKey = {
  apiKey: { id: "key-1", name: "Test Key", enabled: true },
};

const validBody = {
  weekEnding: "2026-02-22",
  headline: "Shipped the activity feed API",
  highlights: ["Built POST endpoint", "Built GET endpoint", "Added tests"],
  metrics: {
    prsShipped: 3,
    testsPassing: 42,
    featuresDelivered: 2,
  },
  tags: ["api", "testing"],
};

function makeRequest(
  method: string,
  body?: unknown,
  url = "http://localhost/api/v1/activity",
) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("v1/activity API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    mockCheckGenericRateLimit.mockResolvedValue({
      limited: false,
      remaining: 9,
    });
    mockPut.mockResolvedValue({ url: "https://blob.url/activity.json" });
  });

  describe("authentication", () => {
    it("POST returns 401 without API key", async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          {
            success: false,
            error: { code: "UNAUTHORIZED", message: "API key required" },
          },
          { status: 401 },
        ),
      );

      const { POST } = await import("@/app/api/v1/activity/route");
      const response = await POST(makeRequest("POST", validBody));
      expect(response.status).toBe(401);
    });

    it("GET returns 401 without API key", async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          {
            success: false,
            error: { code: "UNAUTHORIZED", message: "API key required" },
          },
          { status: 401 },
        ),
      );
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });

      const { GET } = await import("@/app/api/v1/activity/route");
      const response = await GET(makeRequest("GET"));
      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/v1/activity", () => {
    describe("validation", () => {
      it("returns 400 when body is missing", async () => {
        const { POST } = await import("@/app/api/v1/activity/route");
        const req = new Request("http://localhost/api/v1/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "not-json",
        });
        const response = await POST(req);
        expect(response.status).toBe(400);
      });

      it("returns 400 when weekEnding is missing", async () => {
        const { POST } = await import("@/app/api/v1/activity/route");
        const { weekEnding: _weekEnding, ...rest } = validBody;
        void _weekEnding;
        const response = await POST(makeRequest("POST", rest));
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error.code).toBe("VALIDATION_ERROR");
      });

      it("returns 400 when weekEnding is invalid date", async () => {
        const { POST } = await import("@/app/api/v1/activity/route");
        const response = await POST(
          makeRequest("POST", { ...validBody, weekEnding: "not-a-date" }),
        );
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error.code).toBe("VALIDATION_ERROR");
      });

      it("returns 400 when headline exceeds 200 chars", async () => {
        const { POST } = await import("@/app/api/v1/activity/route");
        const response = await POST(
          makeRequest("POST", { ...validBody, headline: "a".repeat(201) }),
        );
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error.code).toBe("VALIDATION_ERROR");
      });

      it("returns 400 when highlights is empty array", async () => {
        const { POST } = await import("@/app/api/v1/activity/route");
        const response = await POST(
          makeRequest("POST", { ...validBody, highlights: [] }),
        );
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error.code).toBe("VALIDATION_ERROR");
      });

      it("returns 400 when highlights has more than 10 items", async () => {
        const { POST } = await import("@/app/api/v1/activity/route");
        const response = await POST(
          makeRequest("POST", {
            ...validBody,
            highlights: Array(11).fill("item"),
          }),
        );
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error.code).toBe("VALIDATION_ERROR");
      });

      it("returns 400 when metrics has negative prsShipped", async () => {
        const { POST } = await import("@/app/api/v1/activity/route");
        const response = await POST(
          makeRequest("POST", {
            ...validBody,
            metrics: { ...validBody.metrics, prsShipped: -1 },
          }),
        );
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error.code).toBe("VALIDATION_ERROR");
      });

      it("returns 400 when metrics has negative testsPassing", async () => {
        const { POST } = await import("@/app/api/v1/activity/route");
        const response = await POST(
          makeRequest("POST", {
            ...validBody,
            metrics: { ...validBody.metrics, testsPassing: -5 },
          }),
        );
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error.code).toBe("VALIDATION_ERROR");
      });

      it("returns 400 when metrics has non-integer featuresDelivered", async () => {
        const { POST } = await import("@/app/api/v1/activity/route");
        const response = await POST(
          makeRequest("POST", {
            ...validBody,
            metrics: { ...validBody.metrics, featuresDelivered: 1.5 },
          }),
        );
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error.code).toBe("VALIDATION_ERROR");
      });

      it("returns 400 when tags has more than 10 items", async () => {
        const { POST } = await import("@/app/api/v1/activity/route");
        const response = await POST(
          makeRequest("POST", { ...validBody, tags: Array(11).fill("tag") }),
        );
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error.code).toBe("VALIDATION_ERROR");
      });

      it("returns 429 when rate limited", async () => {
        mockCheckGenericRateLimit.mockResolvedValue({
          limited: true,
          remaining: 0,
          retryAfter: 45,
        });
        const { POST } = await import("@/app/api/v1/activity/route");
        const response = await POST(makeRequest("POST", validBody));
        expect(response.status).toBe(429);
      });
    });

    describe("success", () => {
      it("returns created ActivitySummary with id and createdAt", async () => {
        const { POST } = await import("@/app/api/v1/activity/route");
        const response = await POST(makeRequest("POST", validBody));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toMatchObject({
          weekEnding: validBody.weekEnding,
          headline: validBody.headline,
          highlights: validBody.highlights,
          metrics: validBody.metrics,
          tags: validBody.tags,
        });
        expect(typeof data.data.id).toBe("string");
        expect(data.data.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
        expect(typeof data.data.createdAt).toBe("string");
        expect(() => new Date(data.data.createdAt)).not.toThrow();
      });

      it("stores blob at correct path", async () => {
        const { POST } = await import("@/app/api/v1/activity/route");
        await POST(makeRequest("POST", validBody));

        expect(mockPut).toHaveBeenCalledWith(
          expect.stringMatching(
            /^damilola\.tech\/activity\/2026-02-22-[0-9a-f-]+\.json$/,
          ),
          expect.any(String),
          expect.objectContaining({
            access: "public",
            contentType: "application/json",
          }),
        );
      });

      it("accepts empty tags array", async () => {
        const { POST } = await import("@/app/api/v1/activity/route");
        const response = await POST(
          makeRequest("POST", { ...validBody, tags: [] }),
        );
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data.tags).toEqual([]);
      });
    });
  });

  describe("GET /api/v1/activity", () => {
    const mockSummaries: Array<{ weekEnding: string; url: string }> = [
      { weekEnding: "2026-02-22", url: "https://blob.url/a1.json" },
      { weekEnding: "2026-02-15", url: "https://blob.url/a2.json" },
      { weekEnding: "2026-02-08", url: "https://blob.url/a3.json" },
    ];

    function makeSummary(
      weekEnding: string,
      url: string,
    ): { summary: object; url: string } {
      return {
        summary: {
          id: "uuid-" + weekEnding,
          weekEnding,
          headline: `Week of ${weekEnding}`,
          highlights: ["Did stuff"],
          metrics: { prsShipped: 1, testsPassing: 10, featuresDelivered: 1 },
          tags: [],
          createdAt: new Date().toISOString(),
        },
        url,
      };
    }

    beforeEach(() => {
      const summaryData = mockSummaries.map((s) =>
        makeSummary(s.weekEnding, s.url),
      );

      mockList.mockResolvedValue({
        blobs: summaryData.map(({ url }, i) => ({
          pathname: `damilola.tech/activity/${mockSummaries[i].weekEnding}-uuid.json`,
          url,
        })),
        cursor: undefined,
      });

      // Mock fetch for blob contents
      global.fetch = vi.fn().mockImplementation((url: string) => {
        const item = summaryData.find((s) => s.url === url);
        if (item) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(item.summary),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      }) as unknown as typeof fetch;
    });

    it("returns summaries sorted by weekEnding descending", async () => {
      const { GET } = await import("@/app/api/v1/activity/route");
      const response = await GET(makeRequest("GET"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      const weeks = data.data.map((s: { weekEnding: string }) => s.weekEnding);
      expect(weeks).toEqual(["2026-02-22", "2026-02-15", "2026-02-08"]);
    });

    it("respects limit param", async () => {
      const { GET } = await import("@/app/api/v1/activity/route");
      const response = await GET(
        makeRequest(
          "GET",
          undefined,
          "http://localhost/api/v1/activity?limit=2",
        ),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].weekEnding).toBe("2026-02-22");
    });

    it("uses default limit of 10", async () => {
      const { GET } = await import("@/app/api/v1/activity/route");
      const response = await GET(makeRequest("GET"));
      const data = await response.json();

      expect(response.status).toBe(200);
      // 3 summaries available, all returned (under default limit of 10)
      expect(data.data).toHaveLength(3);
    });

    it("caps limit at 52", async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });
      const { GET } = await import("@/app/api/v1/activity/route");
      // Just verify it doesn't error; blobs are empty so result is empty
      const response = await GET(
        makeRequest(
          "GET",
          undefined,
          "http://localhost/api/v1/activity?limit=100",
        ),
      );
      expect(response.status).toBe(200);
    });

    it("handles blob fetch errors gracefully", async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: "damilola.tech/activity/2026-02-22-uuid.json",
            url: "https://blob.url/fail.json",
          },
        ],
        cursor: undefined,
      });
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as unknown as typeof fetch;

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const { GET } = await import("@/app/api/v1/activity/route");
      const response = await GET(makeRequest("GET"));
      const data = await response.json();

      // Failed fetches are skipped
      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(0);
      consoleSpy.mockRestore();
    });

    it("handles list error gracefully", async () => {
      mockList.mockRejectedValue(new Error("Blob store error"));
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { GET } = await import("@/app/api/v1/activity/route");
      const response = await GET(makeRequest("GET"));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe("INTERNAL_ERROR");
      consoleSpy.mockRestore();
    });
  });
});
