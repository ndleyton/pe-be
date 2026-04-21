import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

import { renderExerciseTypesSitemap } from "./exerciseTypesSitemap.mjs";

const resolveProjectRoot = () => {
  try {
    return fileURLToPath(new URL("..", import.meta.url));
  } catch {
    return process.cwd();
  }
};

const cwd = resolveProjectRoot();
const mode = process.env.MODE || process.env.NODE_ENV || "production";
const env = loadEnv(mode, cwd, "");
export const DEFAULT_SITE_ORIGIN = "https://app.personalbestie.com";
const siteOrigin = env.APP_SITE_ORIGIN || DEFAULT_SITE_ORIGIN;
const isPlaceholderApiBaseUrl = (value) =>
  value.includes("your-production-api-domain.com");

export const normalizeApiBaseUrl = (value) => {
  const normalized = new URL(value).toString();
  const parsed = new URL(normalized);

  if (!parsed.pathname.startsWith("/api/")) {
    parsed.pathname = parsed.pathname.endsWith("/")
      ? `${parsed.pathname}api/v1/`
      : `${parsed.pathname}/api/v1/`;
  } else if (!parsed.pathname.endsWith("/")) {
    parsed.pathname = `${parsed.pathname}/`;
  }

  parsed.search = "";
  parsed.hash = "";

  return parsed.toString();
};

export const resolveSitemapApiBaseUrl = ({
  sitemapApiBaseUrl,
  apiBaseUrl,
  siteOrigin: fallbackSiteOrigin = DEFAULT_SITE_ORIGIN,
} = {}) => {
  const candidates = [sitemapApiBaseUrl, apiBaseUrl].filter(
    (value) => typeof value === "string" && value.length > 0,
  );

  for (const candidate of candidates) {
    if (isPlaceholderApiBaseUrl(candidate)) {
      continue;
    }

    try {
      return normalizeApiBaseUrl(candidate);
    } catch {
      return normalizeApiBaseUrl(new URL(candidate, fallbackSiteOrigin).toString());
    }
  }

  return null;
};

const apiBaseUrl = resolveSitemapApiBaseUrl({
  sitemapApiBaseUrl: env.SITEMAP_API_BASE_URL,
  apiBaseUrl: env.VITE_API_BASE_URL,
  siteOrigin,
});
const outputPath = resolve(cwd, "public", "exercise-types-sitemap.xml");
const pageLimit = 1000;

const fetchExerciseTypesPage = async (offset) => {
  const apiRoot = new URL(apiBaseUrl);
  const requestUrl = new URL("exercises/exercise-types/", apiRoot);
  requestUrl.searchParams.set("released_only", "true");
  requestUrl.searchParams.set("order_by", "name");
  requestUrl.searchParams.set("offset", String(offset));
  requestUrl.searchParams.set("limit", String(pageLimit));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(requestUrl, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `[sitemap] Failed to fetch exercise types (${response.status} ${response.statusText}) from ${requestUrl.toString()}`,
      );
    }

    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      console.error(
        `[sitemap] Fetch timed out after 15s for ${requestUrl.toString()}`,
      );
      process.exit(1);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchAllExerciseTypes = async () => {
  const collected = [];
  let offset = 0;

  while (true) {
    const page = await fetchExerciseTypesPage(offset);
    const pageItems = Array.isArray(page.data) ? page.data : [];

    collected.push(...pageItems);

    if (page.next_cursor == null) {
      return collected;
    }

    offset = page.next_cursor;
  }
};

export const shouldGenerateSitemap = ({ apiBaseUrl: configuredApiBaseUrl }) =>
  typeof configuredApiBaseUrl === "string" && configuredApiBaseUrl.length > 0;

const main = async () => {
  if (!shouldGenerateSitemap({ apiBaseUrl })) {
    console.log(
      `[sitemap] Skipping exercise types sitemap generation; set SITEMAP_API_BASE_URL or VITE_API_BASE_URL to refresh ${outputPath}`,
    );
    return;
  }

  const exerciseTypes = await fetchAllExerciseTypes();
  const xml = renderExerciseTypesSitemap(exerciseTypes, { siteOrigin });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, xml, "utf8");

  console.log(
    `[sitemap] Wrote ${exerciseTypes.length} exercise type URLs to ${outputPath}`,
  );
};

const invokedScriptUrl = process.argv[1]
  ? new URL(process.argv[1], "file:").href
  : null;

if (invokedScriptUrl === import.meta.url) {
  await main();
}
