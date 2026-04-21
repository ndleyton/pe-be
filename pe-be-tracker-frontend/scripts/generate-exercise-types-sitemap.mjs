import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

import { renderExerciseTypesSitemap } from "./exerciseTypesSitemap.mjs";

const cwd = fileURLToPath(new URL("..", import.meta.url));
const mode = process.env.MODE || process.env.NODE_ENV || "production";
const env = loadEnv(mode, cwd, "");

const apiBaseUrl = env.VITE_API_BASE_URL;
if (!apiBaseUrl) {
  throw new Error(
    "[sitemap] Missing required environment variable: VITE_API_BASE_URL",
  );
}

const siteOrigin = env.APP_SITE_ORIGIN || "https://app.personalbestie.com";
const outputPath = resolve(cwd, "public", "exercise-types-sitemap.xml");
const pageLimit = 1000;

const fetchExerciseTypesPage = async (offset) => {
  const apiRoot = new URL(apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`);
  const requestUrl = new URL("exercises/exercise-types/", apiRoot);
  requestUrl.searchParams.set("released_only", "true");
  requestUrl.searchParams.set("order_by", "name");
  requestUrl.searchParams.set("offset", String(offset));
  requestUrl.searchParams.set("limit", String(pageLimit));

  const response = await fetch(requestUrl, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `[sitemap] Failed to fetch exercise types (${response.status} ${response.statusText}) from ${requestUrl.toString()}`,
    );
  }

  return response.json();
};

const fetchAllExerciseTypesWithImages = async () => {
  const collected = [];
  let offset = 0;

  while (true) {
    const page = await fetchExerciseTypesPage(offset);
    const pageItems = Array.isArray(page.data) ? page.data : [];

    collected.push(
      ...pageItems.filter(
        (exerciseType) =>
          Array.isArray(exerciseType.images) && exerciseType.images.length > 0,
      ),
    );

    if (page.next_cursor == null) {
      return collected;
    }

    offset = page.next_cursor;
  }
};

const main = async () => {
  const exerciseTypes = await fetchAllExerciseTypesWithImages();
  const xml = renderExerciseTypesSitemap(exerciseTypes, { siteOrigin });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, xml, "utf8");

  console.log(
    `[sitemap] Wrote ${exerciseTypes.length} exercise type URLs to ${outputPath}`,
  );
};

await main();
