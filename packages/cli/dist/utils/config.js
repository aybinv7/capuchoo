import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
const CONFIG_DIR_NAME = '.capucho';
const CONFIG_FILE_NAME = 'config.json';
export class ConfigManager {
    projectRoot;
    constructor(projectRoot = process.cwd()) {
        this.projectRoot = projectRoot;
    }
    // Get global config path (~/.capucho/config.json)
    getGlobalConfigPath() {
        return path.join(os.homedir(), CONFIG_DIR_NAME, CONFIG_FILE_NAME);
    }
    // Get project-specific config path (.capucho/project.json)
    // We rename this to project.json for clarity
    getProjectConfigPath() {
        return path.join(this.projectRoot, CONFIG_DIR_NAME, 'project.json');
    }
    // Load configuration with precedence:
    // 1. Flags (passed as arg)
    // 2. Project Config (.capucho/project.json)
    // 3. Global Config (~/.capucho/config.json)
    async loadConfig(flags = {}) {
        const globalConfig = await this.readJsonFile(this.getGlobalConfigPath());
        const projectConfig = await this.readJsonFile(this.getProjectConfigPath());
        const environmentConfig = {
            ...(process.env.CAPUCHO_API_KEY ? { apiKey: process.env.CAPUCHO_API_KEY } : {}),
            ...(process.env.CAPUCHO_ENDPOINT ? { endpoint: process.env.CAPUCHO_ENDPOINT } : {}),
        };
        return {
            ...globalConfig,
            ...projectConfig,
            ...environmentConfig,
            ...flags,
        };
    }
    async setGlobalConfig(key, value) {
        const configPath = this.getGlobalConfigPath();
        const config = await this.readJsonFile(configPath);
        config[key] = value;
        await fs.outputJson(configPath, config, { spaces: 2 });
    }
    async setProjectConfig(key, value) {
        const configPath = this.getProjectConfigPath();
        const config = await this.readJsonFile(configPath);
        config[key] = value;
        await fs.outputJson(configPath, config, { spaces: 2 });
    }
    // Read a JSON file safely
    async readJsonFile(filePath) {
        if (await fs.pathExists(filePath)) {
            try {
                return await fs.readJson(filePath);
            }
            catch {
                console.warn(`Warning: Failed to parse config file at ${filePath}`);
            }
        }
        return {};
    }
}
