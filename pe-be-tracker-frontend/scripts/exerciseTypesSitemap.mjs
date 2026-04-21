export const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export const toSitemapDate = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
};

export const renderExerciseTypesSitemap = (exerciseTypes, { siteOrigin }) => {
  const normalizedSiteOrigin = siteOrigin.endsWith("/")
    ? siteOrigin
    : `${siteOrigin}/`;

  const urlNodes = exerciseTypes
    .map((exerciseType) => {
      const loc = new URL(
        `exercise-types/${exerciseType.id}`,
        normalizedSiteOrigin,
      ).toString();
      const lastmod = toSitemapDate(
        exerciseType.updated_at ?? exerciseType.released_at,
      );

      return [
        "  <url>",
        `    <loc>${escapeXml(loc)}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlNodes}
</urlset>
`;
};
