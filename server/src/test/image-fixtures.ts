import sharp from "sharp";

/** Test images made with sharp at run time; no binary fixtures are committed. */

const white = { r: 255, g: 255, b: 255 };

export function solidJpeg(w: number, h: number, opts: { colour?: { r: number; g: number; b: number } } = {}): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: opts.colour ?? white } }).jpeg().toBuffer();
}

export function solidPng(w: number, h: number, opts: { alpha?: boolean } = {}): Promise<Buffer> {
  return opts.alpha
    ? sharp({ create: { width: w, height: h, channels: 4, background: { r: 30, g: 90, b: 200, alpha: 0.5 } } }).png().toBuffer()
    : sharp({ create: { width: w, height: h, channels: 3, background: white } }).png().toBuffer();
}

const XMP_NS = "http://ns.adobe.com/xap/1.0/\u0000";
const XMP_PACKET = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Fixture</dc:creator></rdf:Description></rdf:RDF></x:xmpmeta>';

/**
 * 1200x900 JPEG with EXIF (including GPS), an XMP packet and a Display-P3 ICC profile. sharp 0.33.5 has no
 * withXmp(), so the XMP APP1 segment is inserted right after the JPEG SOI marker (spec section 2 fallback).
 */
export async function jpegWithMetadata(): Promise<Buffer> {
  const base = await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 120, g: 160, b: 90 } } })
    .withExif({ IFD0: { Make: "Fixture", Model: "Camera" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "6/1 12/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "106/1 49/1 0/1" } })
    .withIccProfile("p3")
    .jpeg()
    .toBuffer();
  const payload = Buffer.concat([Buffer.from(XMP_NS, "latin1"), Buffer.from(XMP_PACKET, "utf8")]);
  const length = Buffer.alloc(2);
  length.writeUInt16BE(payload.length + 2);
  return Buffer.concat([base.subarray(0, 2), Buffer.from([0xff, 0xe1]), length, payload, base.subarray(2)]);
}

export function cmykJpeg(w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 40, b: 40 } } }).toColourspace("cmyk").jpeg().toBuffer();
}

export function orientedJpeg(w: number, h: number, orientation: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: white } }).withMetadata({ orientation }).jpeg().toBuffer();
}

const u24 = (n: number) => Buffer.from([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff]);
const chunk = (fourcc: string, data: Buffer) => {
  const size = Buffer.alloc(4);
  size.writeUInt32LE(data.length);
  return Buffer.concat([Buffer.from(fourcc, "latin1"), size, data, data.length % 2 ? Buffer.from([0]) : Buffer.alloc(0)]);
};

/**
 * Two-frame animated WebP. sharp 0.33.5 reads animation but cannot write it, so one lossless frame from sharp is
 * wrapped twice in ANMF chunks under a VP8X header with the animation flag.
 */
export async function animatedWebp(): Promise<Buffer> {
  const w = 600;
  const h = 600;
  const single = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } } }).webp({ lossless: true }).toBuffer();
  const vp8l = single.subarray(12); // the bitstream chunk(s) after "RIFF....WEBP"
  const frame = Buffer.concat([u24(0), u24(0), u24(w - 1), u24(h - 1), u24(100), Buffer.from([0]), vp8l]);
  const vp8x = Buffer.concat([Buffer.from([0x12, 0, 0, 0]), u24(w - 1), u24(h - 1)]);
  const anim = Buffer.from([0, 0, 0, 0, 0, 0]);
  const body = Buffer.concat([Buffer.from("WEBP", "latin1"), chunk("VP8X", vp8x), chunk("ANIM", anim), chunk("ANMF", frame), chunk("ANMF", frame)]);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(body.length);
  return Buffer.concat([Buffer.from("RIFF", "latin1"), size, body]);
}

export function heicBytes(): Buffer {
  return Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic", "latin1"), Buffer.alloc(16)]);
}

export function svgBytes(): Buffer {
  return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><script>alert(1)</script></svg>');
}

/** FourCCs of the chunks in a RIFF container (used to prove no EXIF, XMP or ICCP chunk survives). */
export function riffChunks(buffer: Buffer): string[] {
  const names: string[] = [];
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const name = buffer.toString("latin1", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    names.push(name);
    offset += 8 + size + (size % 2);
  }
  return names;
}
