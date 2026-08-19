export interface CloudChannel {
    created_at: string;
    id: string;
    name: string;
    public: boolean;
    environment: 'prod' | 'staging' | 'dev';
}
export interface CloudFlavor {
    id: string;
    name: string;
}
export interface CloudProjectConfig {
    channels: CloudChannel[];
    flavors: CloudFlavor[];
}
export declare class CloudConfigService {
    private configManager;
    private cachePath;
    constructor(root: string);
    fetchProjectConfig(): Promise<CloudProjectConfig | null>;
    private saveCache;
    private loadCache;
}
