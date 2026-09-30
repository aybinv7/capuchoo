import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Owner read/write only. */
export const PRIVATE_FILE_MODE = 0o600;

export interface AtomicWriteOptions {
  /** Permission bits applied when the temporary file is created, so there is no window where it is wider. */
  mode?: number;
}

/**
 * Writes a file atomically: a sibling temporary file is created with `mode`, flushed, then renamed
 * over the target. A crash leaves either the old file or the new one, never a truncated secret.
 */
export function writeFileAtomic(
  file: string,
  contents: string | Uint8Array,
  options: AtomicWriteOptions = {},
): void {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });

  const temporary = path.join(
    directory,
    `.${path.basename(file)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );

  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(temporary, "wx", options.mode ?? 0o644);
    fs.writeFileSync(descriptor, contents);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.renameSync(temporary, file);
  } catch (error) {
    if (descriptor !== null) fs.closeSync(descriptor);
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

/** Atomic write restricted to the owner. On Windows the mode is advisory; ACLs are not modelled. */
export function writePrivateFile(file: string, contents: string | Uint8Array): void {
  writeFileAtomic(file, contents, { mode: PRIVATE_FILE_MODE });
}
