import { describe, expect, it } from "vitest";

import {
  escapeXml,
  isPublicImageUrl,
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

  it("filters generated exercise assets from image sitemap entries", () => {
    expect(
      isPublicImageUrl(
        "https://app.personalbestie.com/api/v1/exercises/assets/generated/exercise-type-42/option/0.png",
      ),
    ).toBe(false);
    expect(
      isPublicImageUrl(
        "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bench_Press/0.jpg",
      ),
    ).toBe(true);
  });

  it("renders exercise detail URLs and public image tags", () => {
    const xml = renderExerciseTypesSitemap(
      [
        {
          id: 42,
          name: 'Bench & Dip "Pro"',
          updated_at: "2026-04-20T02:03:04Z",
          images: [
            "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bench_Press/0.jpg",
            "https://app.personalbestie.com/api/v1/exercises/assets/generated/exercise-type-42/option/0.png",
          ],
        },
      ],
      { siteOrigin: "https://app.personalbestie.com" },
    );

    expect(xml).toContain(
      "<loc>https://app.personalbestie.com/exercise-types/42</loc>",
    );
    expect(xml).toContain("<lastmod>2026-04-20</lastmod>");
    expect(xml).toContain(
      "<image:loc>https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bench_Press/0.jpg</image:loc>",
    );
    expect(xml).toContain(
      "<image:title>Bench &amp; Dip &quot;Pro&quot;</image:title>",
    );
    expect(xml).not.toContain("/assets/generated/exercise-type-42/");
  });
});
