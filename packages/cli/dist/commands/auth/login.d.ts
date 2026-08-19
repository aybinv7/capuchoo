import { Command } from '@oclif/core';
export default class AuthLogin extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        'api-key': import("@oclif/core/interfaces").OptionFlag<string | undefined, import("@oclif/core/interfaces").CustomOptions>;
        endpoint: import("@oclif/core/interfaces").OptionFlag<string | undefined, import("@oclif/core/interfaces").CustomOptions>;
    };
    run(): Promise<void>;
    /**
     * Static method to perform login, can be called from other commands
     */
    static performLogin(root: string, flagEndpoint?: string, flagApiKey?: string): Promise<void>;
}
