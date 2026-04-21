const GENERATED_ASSET_SEGMENT = "/exercises/assets/generated/";

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

export const isPublicImageUrl = (imageUrl) => {
  if (typeof imageUrl !== "string" || imageUrl.length === 0) {
    return false;
  }

  try {
    const parsed = new URL(imageUrl);
    return !parsed.pathname.includes(GENERATED_ASSET_SEGMENT);
  } catch {
    return !imageUrl.includes(GENERATED_ASSET_SEGMENT);
  }
};

const renderImageNodes = (exerciseType) => {
  const publicImages = (exerciseType.images ?? []).filter(isPublicImageUrl);
  if (publicImages.length === 0) {
    return "";
  }

  return publicImages
    .map(
      (imageUrl) => `    <image:image>
      <image:loc>${escapeXml(imageUrl)}</image:loc>
      <image:title>${escapeXml(exerciseType.name)}</image:title>
    </image:image>`,
    )
    .join("\n");
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
      const imageNodes = renderImageNodes(exerciseType);

      return [
        "  <url>",
        `    <loc>${escapeXml(loc)}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
        imageNodes || null,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlNodes}
</urlset>
`;
};
