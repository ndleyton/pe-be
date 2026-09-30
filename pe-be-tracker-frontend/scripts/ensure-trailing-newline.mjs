// Tailwind's minified output has no trailing newline, which the repo's
// end-of-file-fixer pre-commit hook would add, making the committed file differ from a fresh build.
import { appendFileSync, readFileSync } from "node:fs";

for (const file of process.argv.slice(2)) {
  if (!readFileSync(file, "utf8").endsWith("\n")) appendFileSync(file, "\n");
}
