import axios from 'axios';
import fs from 'fs-extra';
import path from 'node:path';
import { ConfigManager } from '../utils/config.js';
export class CloudService {
    configManager;
    client = null;
    root;
    constructor(root = process.cwd()) {
        this.root = root;
        this.configManager = new ConfigManager(root);
    }
    async getClient() {
        if (this.client)
            return this.client;
        const config = await this.configManager.loadConfig();
        const endpoint = config.endpoint;
        const apiKey = config.apiKey;
        if (!endpoint || !apiKey) {
            throw new Error('Not authenticated. Please run: capucho auth login');
        }
        this.client = axios.create({
            baseURL: endpoint,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
        return this.client;
    }
    async getProjectConfig() {
        const configPath = path.join(this.root, '.capucho', 'project.json');
        if (!(await fs.pathExists(configPath)))
            return null;
        try {
            return await fs.readJson(configPath);
        }
        catch {
            return null;
        }
    }
    async requireProjectConfig() {
        const config = await this.getProjectConfig();
        if (!config) {
            throw new Error('Project not initialized. Please run: capucho init');
        }
        return config;
    }
    async createApp(data) {
        const client = await this.getClient();
        // Backend expects app_id, not bundle_id
        const response = await client.post('/api/apps', data);
        return response.data;
    }
    async getOrganizations() {
        const client = await this.getClient();
        const response = await client.get('/api/organizations');
        return response.data;
    }
    async getApps() {
        const client = await this.getClient();
        const response = await client.get('/api/apps');
        return response.data;
    }
    async getChannels(appId) {
        const client = await this.getClient();
        const response = await client.get(`/api/apps/${appId}/channels`);
        return response.data;
    }
    async getReleases(appId, channel) {
        const client = await this.getClient();
        const params = channel ? { channel } : {};
        const response = await client.get(`/api/apps/${appId}/releases`, { params });
        return response.data;
    }
    async validateChannel(appId, channelName) {
        const channels = await this.getChannels(appId);
        return channels.some((c) => c.name === channelName);
    }
}
