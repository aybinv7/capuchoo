export interface ExportOptions {
  /** A whole test file, or only the commands to paste into one. */
  complete: boolean;
  /** Where the app's web build is served; routes are appended to it. */
  baseUrl: string;
  /** The Android package a Capubridge flow opens. */
  appPackage: string;
}

export interface ExportResult {
  code: string;
  /** What the export could not carry over, in plain words. */
  warnings: string[];
}
