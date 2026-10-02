/** A CI file `ci init` is about to write, and what to tell the user once it is written. */
export interface CiTarget {
  provider: "github" | "gitlab";
  /** Absolute path. */
  file: string;
  contents: string;
  /** Problems worth saying before anything is written; none of them stops the write. */
  warnings: string[];
  /** Lines printed after the write; an empty string is a blank line. */
  nextSteps: string[];
  /** Merged into the `--json` result. */
  details: Record<string, unknown>;
}
