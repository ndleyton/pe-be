import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DIST_DIR = path.resolve(process.cwd(), process.argv[2] ?? "dist");
const CHECKED_EXTENSIONS = new Set([".js", ".mjs", ".css"]);
const SOURCE_MAP_REFERENCE = /[#@]\s*sourceMappingURL=/;

async function collectBundleFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectBundleFiles(fullPath);
      }
      return CHECKED_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
    }),
  );

  return files.flat();
}

async function main() {
  const bundleFiles = await collectBundleFiles(DIST_DIR);
  const filesWithSourceMapReferences = [];

  for (const filePath of bundleFiles) {
    const contents = await readFile(filePath, "utf8");
    if (SOURCE_MAP_REFERENCE.test(contents)) {
      filesWithSourceMapReferences.push(path.relative(process.cwd(), filePath));
    }
  }

  if (filesWithSourceMapReferences.length > 0) {
    console.error("Production bundles must not expose sourceMappingURL references.");
    for (const filePath of filesWithSourceMapReferences) {
      console.error(`- ${filePath}`);
    }
    process.exit(1);
  }

  console.log(
    `Verified ${bundleFiles.length} bundle files without public sourceMappingURL references.`,
  );
}

main().catch((error) => {
  console.error("Failed to verify production bundles for sourceMappingURL references.");
  console.error(error);
  process.exit(1);
});
