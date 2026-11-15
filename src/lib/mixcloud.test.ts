import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeShow, type ShowSource } from "./mixcloud";

const source: ShowSource = {
  title: "Local title",
  url: "https://www.mixcloud.com/radiowaters/example/",
};

describe("normalizeShow", () => {
  it("prefers the source title and local description over Mixcloud", () => {
    const show = normalizeShow(
      {
        ...source,
        localDescription: "Local description",
        description: "Source description",
      },
      { name: "Mixcloud title", description: "Mixcloud description" },
    );

    expect(show.title).toBe("Local title");
    expect(show.description).toBe("Local description");
  });

  it("falls back to the Mixcloud title when the source title is empty", () => {
    expect(
      normalizeShow({ ...source, title: "" }, { name: "Mixcloud title" }).title,
    ).toBe("Mixcloud title");
  });

  it("prefers a source description and otherwise uses Mixcloud", () => {
    const api = { description: "Mixcloud description" };
    expect(
      normalizeShow({ ...source, description: "Source description" }, api)
        .description,
    ).toBe("Source description");
    expect(normalizeShow(source, api).description).toBe("Mixcloud description");
  });
});

describe("enrich-shows fallback", () => {
  it.each([
    [
      { localDescription: "Updated local description" },
      "Updated local description",
    ],
    [
      { description: "Updated source description" },
      "Updated source description",
    ],
    [{}, "Cached description"],
  ])(
    "keeps source edits fresh when Mixcloud fails: %j",
    async (fields, expected) => {
      const directory = await mkdtemp(join(tmpdir(), "enrich-shows-"));
      try {
        const dataDirectory = join(directory, "src", "data");
        await mkdir(dataDirectory, { recursive: true });
        await writeFile(
          join(dataDirectory, "show-sources.json"),
          JSON.stringify([{ ...source, ...fields }]),
        );
        await writeFile(
          join(dataDirectory, "shows.generated.json"),
          JSON.stringify([
            {
              ...source,
              title: "Cached title",
              description: "Cached description",
              slug: "example",
              playCount: 123,
            },
          ]),
        );

        const scriptUrl = pathToFileURL(
          resolve("scripts/enrich-shows.ts"),
        ).href;
        const tsxUrl = import.meta.resolve("tsx");
        const result = spawnSync(
          process.execPath,
          [
            "--import",
            tsxUrl,
            "--input-type=module",
            "--eval",
            `globalThis.fetch = async () => { throw new Error("Offline test"); }; await import(${JSON.stringify(scriptUrl)});`,
          ],
          { cwd: directory, encoding: "utf8" },
        );

        expect(result.status, result.stderr).toBe(0);
        const [show] = JSON.parse(
          await readFile(join(dataDirectory, "shows.generated.json"), "utf8"),
        );
        expect(show.title).toBe("Local title");
        expect(show.description).toBe(expected);
        expect(show.slug).toBe("example");
        expect(show.playCount).toBe(123);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  );
});
