import { describe, expect, it } from "vitest";

import { escapeXml, renderExerciseTypesSitemap, toSitemapDate } from "./exerciseTypesSitemap.mjs";

describe("exerciseTypesSitemap", () => {
  it("escapes XML special characters", () => {
    expect(escapeXml(`Bench & Dip "Pro" <Test>`)).toBe(
      "Bench &amp; Dip &quot;Pro&quot; &lt;Test&gt;",
    );
  });

  it("formats timestamps into sitemap dates", () => {
    expect(toSitemapDate("2026-04-20T02:03:04Z")).toBe("2026-04-20");
    expect(toSitemapDate("not-a-date")).toBeNull();
  });

  it("renders exercise detail URLs without image tags", () => {
    const xml = renderExerciseTypesSitemap(
      [
        {
          id: 42,
          name: 'Bench & Dip "Pro"',
          updated_at: "2026-04-20T02:03:04Z",
        },
      ],
      { siteOrigin: "https://app.personalbestie.com" },
    );

    expect(xml).toContain(
      "<loc>https://app.personalbestie.com/exercise-types/42</loc>",
    );
    expect(xml).toContain("<lastmod>2026-04-20</lastmod>");
    expect(xml).not.toContain("xmlns:image=");
    expect(xml).not.toContain("<image:image>");
  });
});
