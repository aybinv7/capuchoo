import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { parseBinaryManifest, readApkManifest } from "./android-manifest.js";
import { readZipEntry } from "./zip-entry.js";
import { createBundleZip } from "./zip.js";

type Attr = { name: string; id?: number; string?: string; int?: number; bool?: boolean };
type Element = { name: string; attrs: Attr[] };

function chunk(type: number, headerSize: number, body: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt16LE(type, 0);
  header.writeUInt16LE(headerSize, 2);
  header.writeUInt32LE(8 + body.length, 4);
  return Buffer.concat([header, body]);
}

function stringPool(strings: string[], utf8: boolean): Buffer {
  const encoded = strings.map((value) => {
    if (utf8) {
      const bytes = Buffer.from(value, "utf8");
      return Buffer.concat([Buffer.from([value.length, bytes.length]), bytes, Buffer.from([0])]);
    }
    const length = Buffer.alloc(2);
    length.writeUInt16LE(value.length);
    return Buffer.concat([length, Buffer.from(value, "utf16le"), Buffer.alloc(2)]);
  });
  const offsets = Buffer.alloc(strings.length * 4);
  let offset = 0;
  encoded.forEach((entry, index) => {
    offsets.writeUInt32LE(offset, index * 4);
    offset += entry.length;
  });
  let data = Buffer.concat(encoded);
  if (data.length % 4) data = Buffer.concat([data, Buffer.alloc(4 - (data.length % 4))]);
  const fields = Buffer.alloc(20);
  fields.writeUInt32LE(strings.length, 0);
  fields.writeUInt32LE(0, 4);
  fields.writeUInt32LE(utf8 ? 0x100 : 0, 8);
  fields.writeUInt32LE(28 + offsets.length, 12);
  fields.writeUInt32LE(0, 16);
  return chunk(0x0001, 28, Buffer.concat([fields, offsets, data]));
}

/** A compiled manifest the way aapt2 lays one out: pool, resource map, then start elements. */
function compile(elements: Element[], utf8 = false): Buffer {
  const attrs = elements.flatMap((element) => element.attrs);
  const named = attrs.filter((attr) => attr.id !== undefined);
  const strings = named.map((attr) => attr.name);
  const index = (value: string) => {
    const found = strings.indexOf(value, named.length);
    if (found >= 0) return found;
    strings.push(value);
    return strings.length - 1;
  };
  const nameIndex = (attr: Attr) =>
    attr.id !== undefined ? named.indexOf(attr) : index(attr.name);
  for (const element of elements) index(element.name);
  for (const attr of attrs) if (attr.string !== undefined) index(attr.string);

  const ids = Buffer.alloc(named.length * 4);
  named.forEach((attr, position) => ids.writeUInt32LE(attr.id!, position * 4));

  const starts = elements.map((element) => {
    const ext = Buffer.alloc(20 + element.attrs.length * 20);
    ext.writeUInt32LE(0xffffffff, 0);
    ext.writeUInt32LE(index(element.name), 4);
    ext.writeUInt16LE(20, 8);
    ext.writeUInt16LE(20, 10);
    ext.writeUInt16LE(element.attrs.length, 12);
    element.attrs.forEach((attr, position) => {
      const at = 20 + position * 20;
      ext.writeUInt32LE(0xffffffff, at);
      ext.writeUInt32LE(nameIndex(attr), at + 4);
      const isString = attr.string !== undefined;
      ext.writeUInt32LE(isString ? index(attr.string!) : 0xffffffff, at + 8);
      ext.writeUInt16LE(8, at + 12);
      ext[at + 15] = isString ? 0x03 : attr.bool !== undefined ? 0x12 : 0x10;
      const data = isString
        ? index(attr.string!)
        : attr.bool !== undefined
          ? attr.bool
            ? 0xffffffff
            : 0
          : attr.int!;
      ext.writeUInt32LE(data >>> 0, at + 16);
    });
    const line = Buffer.alloc(8);
    line.writeUInt32LE(0xffffffff, 4);
    return chunk(0x0102, 16, Buffer.concat([line, ext]));
  });

  const body = Buffer.concat([stringPool(strings, utf8), chunk(0x0180, 8, ids), ...starts]);
  return chunk(0x0003, 8, body);
}

const MANIFEST: Element[] = [
  {
    name: "manifest",
    attrs: [
      { name: "versionCode", id: 0x0101021b, int: 42 },
      { name: "versionName", id: 0x0101021c, string: "1.4.0" },
      { name: "package", string: "com.example.field" },
    ],
  },
  { name: "uses-sdk", attrs: [{ name: "minSdkVersion", id: 0x0101020c, int: 26 }] },
  { name: "application", attrs: [{ name: "debuggable", id: 0x0101000f, bool: true }] },
];

describe("parseBinaryManifest", () => {
  it("reads the identity a device reports, from a UTF-16 pool", () => {
    expect(parseBinaryManifest(compile(MANIFEST))).toEqual({
      applicationId: "com.example.field",
      versionCode: 42,
      versionName: "1.4.0",
      minSdk: 26,
      debuggable: true,
    });
  });

  it("reads a UTF-8 pool, and attributes named only by resource id", () => {
    const anonymous = MANIFEST.map((element) => ({
      ...element,
      attrs: element.attrs.map((attr) => (attr.id ? { ...attr, name: "" } : attr)),
    }));
    const parsed = parseBinaryManifest(compile(anonymous, true));
    expect(parsed).toMatchObject({ versionCode: 42, versionName: "1.4.0", minSdk: 26 });
  });

  it("treats a missing debuggable as a release build", () => {
    const release = MANIFEST.filter((element) => element.name !== "application");
    expect(parseBinaryManifest(compile(release)).debuggable).toBe(false);
  });

  it("refuses a manifest without a versionCode, and anything not compiled XML", () => {
    const [manifest] = MANIFEST;
    const noCode = [
      { ...manifest!, attrs: manifest!.attrs.filter((a) => a.name !== "versionCode") },
    ];
    expect(() => parseBinaryManifest(compile(noCode))).toThrow("no versionCode");
    expect(() => parseBinaryManifest(Buffer.from("<manifest/>"))).toThrow("not a compiled");
  });
});

describe("readApkManifest", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-apk-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reads the manifest out of the archive", () => {
    const content = path.join(dir, "content");
    fs.mkdirSync(content);
    fs.writeFileSync(path.join(content, "AndroidManifest.xml"), compile(MANIFEST));
    fs.writeFileSync(path.join(content, "index.html"), "<html></html>");
    const apk = path.join(dir, "app.apk");
    createBundleZip({ webDir: content, outFile: apk });

    expect(readApkManifest(apk).applicationId).toBe("com.example.field");
    expect(readZipEntry(apk, "missing.txt")).toBeNull();
  });

  it("says plainly when the file is not an APK", () => {
    const file = path.join(dir, "notes.txt");
    fs.writeFileSync(file, "hello");
    expect(() => readApkManifest(file)).toThrow("is not a zip archive");
  });
});
