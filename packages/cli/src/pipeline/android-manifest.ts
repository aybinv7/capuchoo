import { readZipEntry } from "./zip-entry.js";

/** What an installed device will report about itself, read from the APK that is shipped. */
export interface ApkManifest {
  applicationId: string;
  versionCode: number;
  versionName: string | null;
  minSdk: number | null;
  debuggable: boolean;
}

const RES_XML = 0x0003;
const RES_STRING_POOL = 0x0001;
const RES_XML_RESOURCE_MAP = 0x0180;
const RES_XML_START_ELEMENT = 0x0102;
const UTF8_FLAG = 0x100;
const NO_INDEX = 0xffffffff;

const TYPE_STRING = 0x03;
const TYPE_INT_DEC = 0x10;
const TYPE_INT_HEX = 0x11;
const TYPE_BOOLEAN = 0x12;

/** android:* attribute resource ids, which name an attribute when its pool string is empty. */
const ATTRIBUTE_IDS: Readonly<Record<number, string>> = {
  0x0101000f: "debuggable",
  0x0101020c: "minSdkVersion",
  0x0101021b: "versionCode",
  0x0101021c: "versionName",
};

type Value = string | number | boolean | null;

function utf8Length(buffer: Buffer, offset: number): [number, number] {
  const first = buffer[offset]!;
  return first & 0x80 ? [((first & 0x7f) << 8) | buffer[offset + 1]!, 2] : [first, 1];
}

function utf16Length(buffer: Buffer, offset: number): [number, number] {
  const first = buffer.readUInt16LE(offset);
  return first & 0x8000
    ? [((first & 0x7fff) << 16) | buffer.readUInt16LE(offset + 2), 4]
    : [first, 2];
}

function readStringPool(buffer: Buffer, start: number): string[] {
  const count = buffer.readUInt32LE(start + 8);
  const flags = buffer.readUInt32LE(start + 16);
  const stringsStart = start + buffer.readUInt32LE(start + 20);
  const headerSize = buffer.readUInt16LE(start + 2);
  const utf8 = (flags & UTF8_FLAG) !== 0;
  const strings: string[] = [];

  for (let index = 0; index < count; index += 1) {
    let offset = stringsStart + buffer.readUInt32LE(start + headerSize + index * 4);
    if (utf8) {
      offset += utf8Length(buffer, offset)[1];
      const [bytes, width] = utf8Length(buffer, offset);
      offset += width;
      strings.push(buffer.toString("utf8", offset, offset + bytes));
    } else {
      const [chars, width] = utf16Length(buffer, offset);
      offset += width;
      strings.push(buffer.toString("utf16le", offset, offset + chars * 2));
    }
  }
  return strings;
}

function attributeValue(buffer: Buffer, offset: number, strings: string[]): Value {
  const raw = buffer.readUInt32LE(offset + 8);
  const type = buffer[offset + 15]!;
  const data = buffer.readUInt32LE(offset + 16);
  if (type === TYPE_STRING || (raw !== NO_INDEX && type !== TYPE_BOOLEAN))
    return strings[raw !== NO_INDEX ? raw : data] ?? null;
  if (type === TYPE_INT_DEC || type === TYPE_INT_HEX) return data;
  if (type === TYPE_BOOLEAN) return data !== 0;
  return null;
}

/** Element name to its attributes, for the elements a release check needs. */
function readElements(
  buffer: Buffer,
  wanted: ReadonlySet<string>,
): Map<string, Map<string, Value>> {
  if (buffer.readUInt16LE(0) !== RES_XML) throw new Error("not a compiled Android XML file");

  let strings: string[] = [];
  let resourceIds: number[] = [];
  const elements = new Map<string, Map<string, Value>>();
  let cursor = buffer.readUInt16LE(2);

  while (cursor + 8 <= buffer.length) {
    const type = buffer.readUInt16LE(cursor);
    const size = buffer.readUInt32LE(cursor + 4);
    if (size < 8) break;

    if (type === RES_STRING_POOL) strings = readStringPool(buffer, cursor);
    else if (type === RES_XML_RESOURCE_MAP) {
      const headerSize = buffer.readUInt16LE(cursor + 2);
      resourceIds = [];
      for (let offset = cursor + headerSize; offset < cursor + size; offset += 4)
        resourceIds.push(buffer.readUInt32LE(offset));
    } else if (type === RES_XML_START_ELEMENT) {
      const ext = cursor + buffer.readUInt16LE(cursor + 2);
      const name = strings[buffer.readUInt32LE(ext + 4)] ?? "";
      if (wanted.has(name) && !elements.has(name)) {
        const attributes = new Map<string, Value>();
        const start = ext + buffer.readUInt16LE(ext + 8);
        const width = buffer.readUInt16LE(ext + 10);
        const count = buffer.readUInt16LE(ext + 12);
        for (let index = 0; index < count; index += 1) {
          const offset = start + index * width;
          const nameIndex = buffer.readUInt32LE(offset + 4);
          const attribute = ATTRIBUTE_IDS[resourceIds[nameIndex] ?? -1] ?? strings[nameIndex];
          if (attribute) attributes.set(attribute, attributeValue(buffer, offset, strings));
        }
        elements.set(name, attributes);
      }
    }
    cursor += size;
  }
  return elements;
}

const asNumber = (value: Value | undefined): number | null =>
  typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value)
      ? Number(value)
      : null;

/** Parses a compiled `AndroidManifest.xml`. */
export function parseBinaryManifest(buffer: Buffer): ApkManifest {
  const elements = readElements(buffer, new Set(["manifest", "uses-sdk", "application"]));
  const manifest = elements.get("manifest");
  const applicationId = manifest?.get("package");
  const versionCode = asNumber(manifest?.get("versionCode"));
  if (typeof applicationId !== "string" || !applicationId)
    throw new Error("the manifest declares no package");
  if (versionCode === null) throw new Error("the manifest declares no versionCode");

  const versionName = manifest?.get("versionName");
  return {
    applicationId,
    versionCode,
    versionName: typeof versionName === "string" ? versionName : null,
    minSdk: asNumber(elements.get("uses-sdk")?.get("minSdkVersion")),
    debuggable: elements.get("application")?.get("debuggable") === true,
  };
}

/** The manifest of an APK, however it was built: Gradle, Android Studio, Kotlin Multiplatform. */
export function readApkManifest(apkPath: string): ApkManifest {
  const entry = readZipEntry(apkPath, "AndroidManifest.xml");
  if (!entry) throw new Error(`${apkPath} has no AndroidManifest.xml, so it is not an APK`);
  try {
    return parseBinaryManifest(entry);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read the manifest of ${apkPath}: ${reason}`, { cause: error });
  }
}
