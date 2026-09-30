// Assembles the static marketing site (Cloudflare Pages direct upload) into dist-static/.
// Cloudflare serves "/" from index.html, so landing.html is copied as index.html.
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const publicDir = `${root}public`;
const outDir = `${root}dist-static`;

if (!existsSync(`${publicDir}/static.css`)) {
  throw new Error("public/static.css is missing; run `pnpm run build:static-css` first.");
}

rmSync(outDir, { recursive: true, force: true });
cpSync(publicDir, outDir, {
  recursive: true,
  filter: (src) => !src.endsWith(".DS_Store") && src !== `${publicDir}/landing.html`,
});
cpSync(`${publicDir}/landing.html`, `${outDir}/index.html`);

console.log(`Static site assembled in ${outDir}`);
