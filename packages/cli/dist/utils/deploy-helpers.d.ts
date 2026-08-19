export interface DeployConfig {
    active: boolean;
    buildCwd?: string;
    buildPackage?: string;
    channel?: string;
    env: string;
    note?: string;
    platform: string;
    required: boolean;
    skipAsset?: boolean;
    type: 'native' | 'ota';
    version?: string;
}
import { MultiStepProgress } from './progress.js';
/**
 * Runs a command and buffers output to a log file on failure.
 */
export declare function runCommand(command: string, cwd: string, silent?: boolean): Promise<void>;
export declare function runBuildSteps(config: DeployConfig, root: string, progress: MultiStepProgress, startStep: number, totalSteps: number): Promise<void>;
/**
 * Finds the APK artifact after build, searching in multiple paths if needed.
 */
export declare function findApk(androidDir: string, variant?: 'debug' | 'release'): string | null;
export declare function deployToGhPages(distDir: string, repo: string, branch?: string): Promise<void>;
export declare function findLatestZip(root: string): {
    name: string;
    path: string;
    time: number;
};
export declare function uploadFile(url: string, filePath: string, formDataFields: {
    fields: Record<string, boolean | number | string>;
    fileField?: string;
}, apiKey?: string): Promise<{
    data: any;
    status: number;
    success: boolean;
}>;
