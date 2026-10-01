import fs from "node:fs";
import zlib from "node:zlib";

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;
/** The end record is 22 bytes plus a comment of at most 65,535. */
const TAIL_BYTES = 22 + 0xffff;

function readAt(fd: number, position: number, length: number): Buffer {
  const buffer = Buffer.alloc(length);
  const read = fs.readSync(fd, buffer, 0, length, position);
  return read === length ? buffer : buffer.subarray(0, read);
}

function findEndRecord(tail: Buffer): number {
  for (let offset = tail.length - 22; offset >= 0; offset -= 1) {
    if (tail.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) return offset;
  }
  return -1;
}

/**
 * One entry of a zip archive, read without loading the archive: an APK is tens of megabytes and
 * the manifest a few kilobytes. Null when the archive has no such entry.
 */
export function readZipEntry(file: string, name: string): Buffer | null {
  const fd = fs.openSync(file, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const tailStart = Math.max(0, size - TAIL_BYTES);
    const tail = readAt(fd, tailStart, size - tailStart);
    const end = findEndRecord(tail);
    if (end < 0) throw new Error(`${file} is not a zip archive`);

    const entries = tail.readUInt16LE(end + 10);
    const directorySize = tail.readUInt32LE(end + 12);
    const directoryOffset = tail.readUInt32LE(end + 16);
    const directory = readAt(fd, directoryOffset, directorySize);

    let cursor = 0;
    for (let index = 0; index < entries; index += 1) {
      if (directory.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_ENTRY) break;
      const method = directory.readUInt16LE(cursor + 10);
      const compressedSize = directory.readUInt32LE(cursor + 20);
      const nameLength = directory.readUInt16LE(cursor + 28);
      const extraLength = directory.readUInt16LE(cursor + 30);
      const commentLength = directory.readUInt16LE(cursor + 32);
      const localOffset = directory.readUInt32LE(cursor + 42);
      const entryName = directory.toString("utf8", cursor + 46, cursor + 46 + nameLength);
      cursor += 46 + nameLength + extraLength + commentLength;
      if (entryName !== name) continue;

      const local = readAt(fd, localOffset, 30);
      if (local.readUInt32LE(0) !== LOCAL_FILE_HEADER)
        throw new Error(`${file}: ${name} has no local header`);
      const dataOffset = localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      const data = readAt(fd, dataOffset, compressedSize);
      if (method === STORED) return data;
      if (method === DEFLATED) return zlib.inflateRawSync(data);
      throw new Error(`${file}: ${name} uses zip compression method ${method}`);
    }
    return null;
  } finally {
    fs.closeSync(fd);
  }
}
