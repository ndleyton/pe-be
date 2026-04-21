import { describe, expect, it } from "vitest";

import {
  normalizeApiBaseUrl,
  resolveSitemapApiBaseUrl,
  shouldGenerateSitemap,
} from "./generate-exercise-types-sitemap.mjs";
import {
  escapeXml,
  renderExerciseTypesSitemap,
  toSitemapDate,
} from "./exerciseTypesSitemap.mjs";

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

  it("normalizes bare API origins to the backend API root", () => {
    expect(normalizeApiBaseUrl("http://localhost:8000")).toBe(
      "http://localhost:8000/api/v1/",
    );
    expect(normalizeApiBaseUrl("http://backend:8000/")).toBe(
      "http://backend:8000/api/v1/",
    );
  });

  it("preserves explicit API roots when resolving sitemap fetch URLs", () => {
    expect(
      resolveSitemapApiBaseUrl({
        apiBaseUrl: "http://localhost:8000/api/v1",
      }),
    ).toBe("http://localhost:8000/api/v1/");
    expect(
      resolveSitemapApiBaseUrl({
        apiBaseUrl: "http://localhost:8000",
      }),
    ).toBe("http://localhost:8000/api/v1/");
  });

  it("does not fall back to the production app origin", () => {
    expect(resolveSitemapApiBaseUrl({})).toBeNull();
    expect(shouldGenerateSitemap({ apiBaseUrl: null })).toBe(false);
    expect(
      shouldGenerateSitemap({ apiBaseUrl: "http://localhost:8000/api/v1/" }),
    ).toBe(true);
  });
});
