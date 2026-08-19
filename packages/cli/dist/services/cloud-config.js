import axios from 'axios';
import fs from 'fs-extra';
import path from 'node:path';
import { ConfigManager } from '../utils/config.js';
const CACHE_FILE = 'cloud-cache.json';
export class CloudConfigService {
    configManager;
    cachePath;
    constructor(root) {
        this.configManager = new ConfigManager(root);
        this.cachePath = path.join(this.configManager.getProjectConfigPath(), '..', CACHE_FILE);
    }
    async fetchProjectConfig() {
        const config = await this.configManager.loadConfig();
        const endpoint = config.endpoint || config.VITE_UPDATE_API_URL;
        const apiKey = config.apiKey;
        if (!endpoint || !apiKey) {
            return this.loadCache();
        }
        try {
            // Fetch Config from API
            // Endpoint: /api/project/config (Proposed)
            const response = await axios.get(`${endpoint}/api/project/config`, {
                headers: { Authorization: `Bearer ${apiKey}` },
                validateStatus: () => true,
            });
            if (response.status === 200 && response.data) {
                const cloudConfig = response.data;
                await this.saveCache(cloudConfig);
                return cloudConfig;
            }
        }
        catch {
            // Console warn if needed, but we silently fall back to cache
        }
        return this.loadCache();
    }
    async saveCache(data) {
        try {
            await fs.outputJson(this.cachePath, data, { spaces: 2 });
        }
        catch {
            // Ignore cache write errors
        }
    }
    async loadCache() {
        if (await fs.pathExists(this.cachePath)) {
            try {
                return await fs.readJson(this.cachePath);
            }
            catch {
                // Ignore cache read errors
            }
        }
        return null;
    }
}
