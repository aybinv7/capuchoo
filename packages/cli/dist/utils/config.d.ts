export interface CapuchoConfig {
    [key: string]: unknown;
    active?: boolean;
    apiKey?: string;
    appId?: string;
    appName?: string;
    apps?: Array<{
        app_id: string;
        icon_url?: string;
        id: string;
        name: string;
        organization_id: string;
        role: string;
    }>;
    authenticatedAt?: string;
    BUILD_NUMBER?: string;
    channel?: string;
    defaultAppId?: string;
    defaultEnvironment?: string;
    endpoint?: string;
    environment?: string;
    environments?: Record<string, {
        appId: string;
        channel: string;
    }>;
    flavor?: string;
    gitTagVersion?: boolean;
    note?: string;
    organization?: {
        name: string;
    };
    organizations?: Array<{
        id: string;
        name: string;
        role: string;
        slug: string;
    }>;
    required?: boolean;
    skipAsset?: boolean;
    skipBuild?: boolean;
    user?: {
        email: string;
        id?: string;
        role?: string;
    };
    version?: string;
    VERSION_CODE?: string;
    VITE_APP_ID?: string;
    VITE_UPDATE_API_URL?: string;
    yes?: boolean;
}
export declare class ConfigManager {
    private projectRoot;
    constructor(projectRoot?: string);
    getGlobalConfigPath(): string;
    getProjectConfigPath(): string;
    loadConfig(flags?: Partial<CapuchoConfig>): Promise<CapuchoConfig>;
    setGlobalConfig(key: string, value: unknown): Promise<void>;
    setProjectConfig(key: string, value: unknown): Promise<void>;
    private readJsonFile;
}
