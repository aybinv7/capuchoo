import type { StackFrame } from "@capuchoo/core";

export { bundlePath, isLibrarySource, parseStack, type StackFrame } from "@capuchoo/core";

export interface OriginalPosition {
  source: string;
  line: number;
  column: number;
  name: string | null;
  /** The lines around `line` from the map's embedded sources; `start` is the first one's number. */
  context: { start: number; lines: string[] } | null;
}

export interface ResolvedFrame extends StackFrame {
  original: OriginalPosition | null;
  /** Code the app did not write: a dependency, the framework, the browser. */
  library: boolean;
}
