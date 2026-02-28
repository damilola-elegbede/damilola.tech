import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const baseUrl = new URL(req.url).origin;
    const response = await fetch(`${baseUrl}/api/v1/activity?limit=52`, {
      headers: {
        "x-api-key": process.env.DK_API_KEY ?? "",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { data: [] },
        {
          headers: {
            "Cache-Control":
              "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        },
      );
    }

    const json = await response.json();
    const data = Array.isArray(json?.data) ? json.data : [];

    return NextResponse.json(
      { data },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { data: [] },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  }
}
