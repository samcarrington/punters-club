import { readFile } from "node:fs/promises";

const main = async () => {
  const [inputPath, ...extraArgs] = process.argv.slice(2);

  if (!inputPath || extraArgs.length > 0) {
    throw new Error(
      "Usage: pnpm exec tsx scripts/convert-tracklist.ts <input.txt>",
    );
  }

  const text = await readFile(inputPath, "utf8");
  const tracklist: { position: number; artist: string; title: string }[] = [];

  for (const [lineIndex, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;

    const separatorIndex = line.indexOf(" - ");
    const artist = line.slice(0, separatorIndex).trim();
    const title = line.slice(separatorIndex + 3).trim();

    if (separatorIndex < 0 || !artist || !title) {
      throw new Error(
        `Invalid track on line ${lineIndex + 1}: expected "artist - title".`,
      );
    }

    tracklist.push({ position: tracklist.length + 1, artist, title });
  }

  if (tracklist.length === 0) {
    throw new Error("No tracks found in input file.");
  }

  console.log(JSON.stringify(tracklist, null, 2));
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
