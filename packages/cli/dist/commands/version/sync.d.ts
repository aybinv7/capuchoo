import { Command } from '@oclif/core';
export default class VersionSync extends Command {
    static description: string;
    static flags: {
        bump: import("@oclif/core/interfaces").BooleanFlag<boolean>;
        environment: import("@oclif/core/interfaces").OptionFlag<string | undefined, import("@oclif/core/interfaces").CustomOptions>;
    };
    run(): Promise<void>;
}
