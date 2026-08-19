import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs-extra';
import { exec } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import ghpages from 'gh-pages';
const execAsync = promisify(exec);
/**
 * Runs a command and buffers output to a log file on failure.
 */
export async function runCommand(command, cwd, silent = true) {
    let stdoutBuffer = '';
    let stderrBuffer = '';
    try {
        const { stdout, stderr } = await execAsync(command, { cwd });
        stdoutBuffer = stdout;
        stderrBuffer = stderr;
        if (!silent) {
            console.log(stdout);
        }
    }
    catch (error) {
        const fullLog = `
========================================
COMMAND: ${command}
CWD: ${cwd}
ERROR: ${error.message}
----------------------------------------
STDOUT:
${error.stdout || stdoutBuffer}
----------------------------------------
STDERR:
${error.stderr || stderrBuffer}
========================================
`;
        const logFile = path.join(process.cwd(), 'capucho-deploy.log');
        fs.appendFileSync(logFile, fullLog);
        throw error;
    }
}
export async function runBuildSteps(config, root, progress, startStep, totalSteps) {
    const { env, platform, skipAsset } = config;
    // Step 3: Asset Generation
    progress.nextStep(`[3/${totalSteps}] Generating assets for ${env}...`);
    if (!skipAsset) {
        await runCommand(`pnpm run assets:${env}`, root, true);
    }
    else {
        progress.updateMessage(`[3/${totalSteps}] Skipping assets...`);
    }
    // Step 4: Build
    progress.nextStep(`[4/${totalSteps}] Building for ${env}...`);
    const buildCwd = config.buildCwd ?? root;
    const buildCmd = config.buildPackage
        ? `pnpm exec vp run ${config.buildPackage}#build:${env}`
        : `pnpm build:${env}`;
    await runCommand(buildCmd, buildCwd, true);
    // Step 5: Trapeze
    progress.nextStep(`[5/${totalSteps}] Running Trapeze...`);
    await runCommand(`pnpm trapeze:${env}`, root, true);
    // Step 6: Capacitor Sync
    progress.nextStep(`[6/${totalSteps}] Syncing Capacitor...`);
    await runCommand(`pnpm exec cap sync ${platform}`, root, true);
}
/**
 * Finds the APK artifact after build, searching in multiple paths if needed.
 */
export function findApk(androidDir, variant = 'release') {
    const variantPath = path.join(androidDir, 'app/build/outputs/apk', variant);
    if (!fs.existsSync(variantPath))
        return null;
    const files = fs.readdirSync(variantPath, { recursive: true });
    const apkFile = files.find((f) => f.endsWith('.apk') && !f.includes('androidTest'));
    if (apkFile) {
        return path.join(variantPath, apkFile);
    }
    return null;
}
export async function deployToGhPages(distDir, repo, branch = 'assets') {
    await ghpages.publish(distDir, {
        branch,
        repo,
        message: `Auto-deploy assets: ${new Date().toISOString()}`,
        dotfiles: true,
    });
}
export function findLatestZip(root) {
    const files = fs
        .readdirSync(root)
        .filter((f) => f.endsWith('.zip'))
        .map((f) => ({
        name: f,
        path: path.join(root, f),
        time: fs.statSync(path.join(root, f)).mtime.getTime(),
    }))
        .sort((a, b) => b.time - a.time);
    return files[0] || null;
}
export async function uploadFile(url, filePath, formDataFields, apiKey) {
    const form = new FormData();
    // Add file
    form.append(formDataFields.fileField || 'file', fs.createReadStream(filePath));
    // Add other fields
    for (const [key, value] of Object.entries(formDataFields.fields)) {
        if (value !== null && value !== undefined) {
            form.append(key, value);
        }
    }
    // Headers
    const headers = {
        ...form.getHeaders(),
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), // Example auth header if needed
    };
    try {
        const response = await axios.post(url, form, {
            headers,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        });
        return { data: response.data, status: response.status, success: true };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Type assertion for axios error response
        const axiosError = error;
        return {
            data: axiosError.response?.data || errorMessage,
            status: axiosError.response?.status || 0,
            success: false,
        };
    }
}
