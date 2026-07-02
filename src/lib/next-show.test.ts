import { describe, expect, it } from "vitest";
import { decodeEntities, stripHtml } from "./next-show";

describe("decodeEntities", () => {
  it("decodes numeric decimal entities (curly apostrophe, en dash)", () => {
    expect(decodeEntities("The Punters&#8217; Club &#8211; Summer")).toBe(
      "The Punters’ Club – Summer",
    );
  });

  it("decodes hex and common named entities", () => {
    expect(decodeEntities("Rock &amp; Roll &#x2019;s &quot;best&quot;")).toBe(
      'Rock & Roll ’s "best"',
    );
  });

  it("leaves plain text untouched", () => {
    expect(decodeEntities("Deep Bath with n_sonic")).toBe(
      "Deep Bath with n_sonic",
    );
  });
});

describe("stripHtml", () => {
  it("removes tags, decodes entities, collapses whitespace", () => {
    expect(stripHtml("<p>Hello&#8230;  <b>world</b></p>")).toBe(
      "Hello… world",
    );
  });
});
