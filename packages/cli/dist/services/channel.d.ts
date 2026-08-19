export declare class ChannelService {
    private configManager;
    constructor(root: string);
    getChannels(env?: string): Promise<string[]>;
}
