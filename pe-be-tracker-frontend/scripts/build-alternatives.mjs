// Renders the /alternatives/ comparison pages (plus the matching sitemap.xml and llms.txt blocks)
// from static-site/alternatives/. Run via `pnpm run build:alternatives`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { competitors } from "../static-site/alternatives/competitors/index.mjs";
import {
  renderComparisonPage,
  renderIndexPage,
  renderLlmsBlock,
  renderSitemapBlock,
} from "../static-site/alternatives/template.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const publicDir = `${root}public`;

export const replaceBlock = (source, block, file) => {
  const pattern = /(<!-- alternatives:start[^>]*-->\n)[\s\S]*?(<!-- alternatives:end -->)/;
  if (!pattern.test(source)) {
    throw new Error(`${file} is missing the <!-- alternatives:start --> / <!-- alternatives:end --> markers`);
  }
  const indent = file.endsWith(".xml") ? "  " : "";
  return source.replace(pattern, (_, start, end) => `${start}${block}\n${indent}${end}`);
};

/** Returns { relativePathInPublic: contents } for every file this script owns. */
export const renderAll = (readPublicFile = (name) => readFileSync(`${publicDir}/${name}`, "utf8")) => {
  const files = { "alternatives/index.html": renderIndexPage(competitors) };
  for (const competitor of competitors) {
    files[`alternatives/${competitor.slug}/index.html`] = renderComparisonPage(competitor, competitors);
  }
  files["sitemap.xml"] = replaceBlock(readPublicFile("sitemap.xml"), renderSitemapBlock(competitors), "sitemap.xml");
  files["llms.txt"] = replaceBlock(readPublicFile("llms.txt"), renderLlmsBlock(competitors), "llms.txt");
  return files;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [name, contents] of Object.entries(renderAll())) {
    const target = `${publicDir}/${name}`;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
  console.log(`Rendered ${competitors.length} comparison page(s) + index`);
}
