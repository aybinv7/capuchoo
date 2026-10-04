import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { RunRecord } from "../results.ts";
import { summarize, toMarkdown } from "./summarize.ts";

async function main() {
  const directory = process.argv[2];
  if (!directory) throw new Error("Usage: report <results directory>");
  const folder = resolve(directory);
  const text = await readFile(join(folder, "runs.jsonl"), "utf8");
  const runs = text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RunRecord);
  const summary = summarize(runs);
  await writeFile(join(folder, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  const markdown = toMarkdown(summary);
  await writeFile(join(folder, "summary.md"), markdown);
  process.stdout.write(markdown);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
