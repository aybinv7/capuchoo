export type ChangeOp = "insert" | "update" | "delete";

/** `undefined` is a column the change does not mention; `null` is SQL NULL. */
export type ChangeValue = number | bigint | string | Uint8Array | null | undefined;

export interface DecodedChange {
  table: string;
  op: ChangeOp;
  indirect: boolean;
  /** Which columns are part of the primary key, by position. */
  primaryKey: boolean[];
  /** Values before the change; empty for an insert. */
  old: ChangeValue[];
  /** Values after the change; empty for a delete. */
  new: ChangeValue[];
}

const OPS: Record<number, ChangeOp> = { 18: "insert", 23: "update", 9: "delete" };
const decoder = new TextDecoder();

class Reader {
  offset = 0;
  constructor(readonly bytes: Uint8Array) {}

  get done(): boolean {
    return this.offset >= this.bytes.length;
  }

  byte(): number {
    if (this.offset >= this.bytes.length) throw new RangeError("changeset ends early");
    return this.bytes[this.offset++]!;
  }

  /** SQLite's varint: seven bits per byte for up to eight bytes, all eight bits of a ninth. */
  varint(): number {
    let value = 0n;
    for (let index = 0; index < 8; index++) {
      const byte = this.byte();
      value = (value << 7n) | BigInt(byte & 0x7f);
      if ((byte & 0x80) === 0) return Number(value);
    }
    return Number((value << 8n) | BigInt(this.byte()));
  }

  take(length: number): Uint8Array {
    if (this.offset + length > this.bytes.length) throw new RangeError("changeset ends early");
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  cstring(): string {
    const end = this.bytes.indexOf(0, this.offset);
    if (end < 0) throw new RangeError("unterminated table name");
    const text = decoder.decode(this.bytes.subarray(this.offset, end));
    this.offset = end + 1;
    return text;
  }

  value(): ChangeValue {
    const type = this.byte();
    switch (type) {
      case 0:
        return undefined;
      case 1: {
        const big = new DataView(this.take(8).slice().buffer).getBigInt64(0);
        return big >= BigInt(Number.MIN_SAFE_INTEGER) && big <= BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(big)
          : big;
      }
      case 2:
        return new DataView(this.take(8).slice().buffer).getFloat64(0);
      case 3:
        return decoder.decode(this.take(this.varint()));
      case 4:
        return this.take(this.varint()).slice();
      case 5:
        return null;
      default:
        throw new RangeError(`unknown value type ${type}`);
    }
  }

  record(columns: number): ChangeValue[] {
    return Array.from({ length: columns }, () => this.value());
  }
}

/**
 * Decodes a SQLite session changeset without loading SQLite: the format is a run of table headers,
 * each followed by its changes, each a record of typed values.
 */
export function decodeChangeset(bytes: Uint8Array): DecodedChange[] {
  const reader = new Reader(bytes);
  const changes: DecodedChange[] = [];
  let table = "";
  let primaryKey: boolean[] = [];

  while (!reader.done) {
    const marker = reader.byte();
    if (marker === 0x54 || marker === 0x50) {
      const columns = reader.varint();
      primaryKey = Array.from(reader.take(columns), (flag) => flag !== 0);
      table = reader.cstring();
      continue;
    }
    const op = OPS[marker];
    if (!op) throw new RangeError(`unknown change marker ${marker}`);
    const indirect = reader.byte() !== 0;
    const columns = primaryKey.length;
    const old = op === "insert" ? [] : reader.record(columns);
    const next = op === "delete" ? [] : reader.record(columns);
    changes.push({ table, op, indirect, primaryKey, old, new: next });
  }
  return changes;
}

export function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** The primary key of a change as one stable string, from whichever side carries it. */
export function changeKey(change: DecodedChange): string {
  const source = change.op === "insert" ? change.new : change.old;
  return change.primaryKey
    .map((isKey, index) => (isKey ? String(source[index]) : null))
    .filter((part): part is string => part !== null)
    .join("·");
}
