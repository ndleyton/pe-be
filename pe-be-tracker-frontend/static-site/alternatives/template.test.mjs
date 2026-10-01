// @vitest-environment node
import { describe, expect, it } from "vitest";

import { renderAll, replaceBlock } from "../../scripts/build-alternatives.mjs";
import { competitors } from "./competitors/index.mjs";

const files = renderAll();
const page = (slug) => files[`alternatives/${slug}/index.html`];
const jsonLd = (html) =>
  JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@graph"];
const unescape = (text) =>
  text.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");

describe("alternatives pages", () => {
  it("uses unique slugs and ISO dates", () => {
    expect(new Set(competitors.map((c) => c.slug)).size).toBe(competitors.length);
    for (const { published, modified, verified } of competitors) {
      for (const date of [published, modified, verified]) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it.each(competitors.map((c) => [c.slug, c]))("%s: table rows match the column count", (_slug, c) => {
    for (const row of c.table.rows) expect(row.cells).toHaveLength(c.table.columns.length + 1);
  });

  it.each(competitors.map((c) => [c.slug, c]))("%s: FAQ JSON-LD mirrors the visible FAQ", (slug, c) => {
    const html = page(slug);
    const faqPage = jsonLd(html).find((node) => node["@type"] === "FAQPage");
    expect(faqPage.mainEntity.map((q) => q.name)).toEqual(c.faq.map((item) => item.q));
    for (const { q, a } of c.faq) {
      expect(unescape(html)).toContain(q);
      expect(unescape(html)).toContain(a);
    }
  });

  it.each(competitors.map((c) => [c.slug]))("%s: has a canonical URL and links to /static.css", (slug) => {
    const html = page(slug);
    expect(html).toContain(`<link rel="canonical" href="https://www.personalbestie.com/alternatives/${slug}/">`);
    expect(html).toContain('<link rel="stylesheet" href="/static.css">');
    expect(html).not.toContain("cdn.tailwindcss.com");
  });

  it("lists every page on the index, in the sitemap, and in llms.txt", () => {
    for (const { slug } of competitors) {
      expect(files["alternatives/index.html"]).toContain(`/alternatives/${slug}/`);
      expect(files["sitemap.xml"]).toContain(`<loc>https://www.personalbestie.com/alternatives/${slug}/</loc>`);
      expect(files["llms.txt"]).toContain(`/alternatives/${slug}/`);
    }
  });

  it("throws when the generated-block markers are missing", () => {
    expect(() => replaceBlock("<urlset></urlset>", "x", "sitemap.xml")).toThrow(/markers/);
  });
});
