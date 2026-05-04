import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://damilola.tech";

  return [
    {
      url: base,
      lastModified: new Date("2026-05-01"),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${base}/consulting`,
      lastModified: new Date("2026-05-03"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/projects/cortex/case-study`,
      lastModified: new Date("2026-05-01"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/projects/cortex/activity`,
      lastModified: new Date("2026-05-01"),
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];
}
