import axios from 'axios';
import { ConfigManager } from '../utils/config.js';
export class AuthService {
    configManager;
    constructor(root = process.cwd()) {
        this.configManager = new ConfigManager(root);
    }
    /**
     * Fetch user profile with organizations and apps from /api/auth/me
     */
    async fetchUserProfile(endpoint, apiKey) {
        try {
            const response = await axios.get(`${endpoint}/api/auth/me`, {
                headers: { Authorization: `Bearer ${apiKey}` },
                validateStatus: () => true,
            });
            if (response.status === 200 && response.data) {
                return response.data;
            }
            return null;
        }
        catch {
            return null;
        }
    }
    /**
     * Get accessible apps from stored config
     */
    async getAccessibleApps() {
        const config = await this.configManager.loadConfig();
        return config.apps || [];
    }
    /**
     * Get organizations from stored config
     */
    async getOrganizations() {
        const config = await this.configManager.loadConfig();
        return config.organizations || [];
    }
    /**
     * Get stored API key
     */
    async getApiKey() {
        const config = await this.configManager.loadConfig();
        return config.apiKey || null;
    }
    /**
     * Get stored endpoint
     */
    async getEndpoint() {
        const config = await this.configManager.loadConfig();
        return config.endpoint || config.VITE_UPDATE_API_URL || null;
    }
    /**
     * Verify stored credentials are valid
     */
    async verifyCredentials() {
        const endpoint = await this.getEndpoint();
        const apiKey = await this.getApiKey();
        if (!endpoint || !apiKey) {
            return { valid: false };
        }
        const profile = await this.fetchUserProfile(endpoint, apiKey);
        if (profile) {
            return {
                user: profile.user,
                valid: true,
            };
        }
        return { valid: false };
    }
}
