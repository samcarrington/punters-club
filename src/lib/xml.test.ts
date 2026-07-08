import { describe, expect, it } from "vitest";

import { xmlEscape } from "./xml";

describe("xmlEscape", () => {
  it("escapes characters with special meaning in XML text", () => {
    expect(xmlEscape(`https://punters.club/shows/?q=garage&host="Gwawr"&note='Kel<Surprise>'`)).toBe(
      "https://punters.club/shows/?q=garage&amp;host=&quot;Gwawr&quot;&amp;note=&apos;Kel&lt;Surprise&gt;&apos;",
    );
  });
});
