import { HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES } from "./limits";
import { altLength, cleanAlt, defaultAlt, detectImageType, parseAlt, targetsFor } from "./rules";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const riffWebp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const ftyp = (brand: string) => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftyp"), Buffer.from(brand), Buffer.alloc(8)]);

const refusal = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error as HttpException;
  }
  throw new Error("expected a refusal");
};

describe("alt text rules", () => {
  it.each([["   "], [" \u00A0\u200B\u200D\uFEFF"], ["\n\t"]])("parseAlt refuses %j", (input) => {
    const error = refusal(() => parseAlt(input));
    expect(error.getStatus()).toBe(422);
    expect(error.getResponse()).toMatchObject({ code: "VALIDATION" });
  });

  it.each([["word joiner", "\u2060"], ["left-to-right mark", "\u200E"], ["right-to-left mark", "\u200F"], ["Mongolian vowel separator", "\u180E"], ["combining grapheme joiner", "\u034F"]])(
    "an alt made only of a %s is refused, and it is trimmed from the ends",
    (_name, ch) => {
      expect(() => parseAlt(ch)).toThrow();
      expect(cleanAlt(`${ch}Kabel${ch}`)).toBe("Kabel");
    },
  );

  it("cleanAlt trims whitespace and zero-width ends and turns inner control runs into one space", () => {
    expect(cleanAlt("\u200B a\n\tb  ")).toBe("a b");
  });

  it("counts code points: 125 emoji ok, 126 refused", () => {
    expect(parseAlt("😀".repeat(125))).toHaveLength(250);
    expect(() => parseAlt("😀".repeat(126))).toThrow();
    expect(altLength("😀".repeat(125))).toBe(125);
  });

  it("accepts exactly 125 code points and refuses 126", () => {
    expect(parseAlt("a".repeat(125))).toHaveLength(125);
    expect(() => parseAlt("a".repeat(126))).toThrow();
  });

  it("stores HTML verbatim", () => {
    expect(parseAlt("<img src=x onerror=alert(1)>")).toBe("<img src=x onerror=alert(1)>");
  });

  it("refuses a non-string alt", () => {
    expect(() => parseAlt(undefined)).toThrow();
    expect(() => parseAlt(42)).toThrow();
  });

  it("defaultAlt cuts a 140-character name to 125 code points and prefixes 'Foto '", () => {
    const alt = defaultAlt("x".repeat(140));
    expect(alt.startsWith("Foto ")).toBe(true);
    expect(altLength(alt)).toBe(125);
    expect(defaultAlt("Kabel HDMI")).toBe("Foto Kabel HDMI");
  });
});

describe("detectImageType", () => {
  it.each<[Buffer, string]>([
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "jpeg"],
    [png, "png"],
    [riffWebp, "webp"],
    [ftyp("heic"), "heic"],
    [ftyp("heix"), "heic"],
    [ftyp("hevc"), "heic"],
    [ftyp("mif1"), "heic"],
    [ftyp("msf1"), "heic"],
    [ftyp("avif"), "heic"],
    [Buffer.from("<svg "), "unsupported"],
    [Buffer.from("<?xml "), "unsupported"],
    [Buffer.from("GIF89a"), "unsupported"],
    [Buffer.from("GIF87a"), "unsupported"],
    [Buffer.from("hello.jpg text"), "unsupported"],
    [Buffer.alloc(0), "unsupported"],
  ])("detectImageType %#", (head, expected) => {
    expect(detectImageType(head)).toBe(expected);
  });
});

describe("targetsFor", () => {
  it.each<[number, number[]]>([
    [479, []],
    [480, [480]],
    [960, [480, 960]],
    [1200, [480, 960, 1200]],
    [1599, [480, 960, 1599]],
    [1600, [480, 960, 1600]],
    [5000, [480, 960, 1600]],
  ])("targetsFor(%i)", (shorter, expected) => {
    expect(targetsFor(shorter)).toEqual(expected);
  });
});

describe("limits", () => {
  it("MAX_UPLOAD_BYTES is 10 MiB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(10485760);
  });
});
