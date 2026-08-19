import { Command } from '@oclif/core';
export default class DeployNative extends Command {
    static description: string;
    static flags: {
        active: import("@oclif/core/interfaces").BooleanFlag<boolean>;
        channel: import("@oclif/core/interfaces").OptionFlag<string | undefined, import("@oclif/core/interfaces").CustomOptions>;
        note: import("@oclif/core/interfaces").OptionFlag<string, import("@oclif/core/interfaces").CustomOptions>;
        platform: import("@oclif/core/interfaces").OptionFlag<string, import("@oclif/core/interfaces").CustomOptions>;
        type: import("@oclif/core/interfaces").OptionFlag<string | undefined, import("@oclif/core/interfaces").CustomOptions>;
        required: import("@oclif/core/interfaces").BooleanFlag<boolean>;
        skipAsset: import("@oclif/core/interfaces").BooleanFlag<boolean>;
        skipBuild: import("@oclif/core/interfaces").BooleanFlag<boolean>;
        githubPages: import("@oclif/core/interfaces").BooleanFlag<boolean>;
        version: import("@oclif/core/interfaces").OptionFlag<string, import("@oclif/core/interfaces").CustomOptions>;
        verbose: import("@oclif/core/interfaces").BooleanFlag<boolean>;
        yes: import("@oclif/core/interfaces").BooleanFlag<boolean>;
    };
    run(): Promise<void>;
}
