import { CloudApp, CloudChannel, CloudOrganization, ProjectConfig } from '../types/cloud.js';
export declare class CloudService {
    private configManager;
    private client;
    private root;
    constructor(root?: string);
    private getClient;
    getProjectConfig(): Promise<ProjectConfig | null>;
    requireProjectConfig(): Promise<ProjectConfig>;
    createApp(data: {
        name: string;
        app_id: string;
        platform: string;
        organization_id: string;
    }): Promise<CloudApp>;
    getOrganizations(): Promise<CloudOrganization[]>;
    getApps(): Promise<CloudApp[]>;
    getChannels(appId: string): Promise<CloudChannel[]>;
    getReleases(appId: string, channel?: string): Promise<any[]>;
    validateChannel(appId: string, channelName: string): Promise<boolean>;
}
