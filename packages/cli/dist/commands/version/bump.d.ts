import { Command } from '@oclif/core';
export default class VersionBump extends Command {
    static args: {
        readonly type: {
            readonly description: "Version bump type (major, minor, patch)";
            readonly name: "type";
            readonly options: readonly ["major", "minor", "patch"];
            readonly required: true;
        };
    };
    static description: string;
    static flags: {
        environment: import("@oclif/core/interfaces").OptionFlag<string | undefined, import("@oclif/core/interfaces").CustomOptions>;
        'git-tag-version': import("@oclif/core/interfaces").BooleanFlag<boolean>;
    };
    run(): Promise<void>;
}
