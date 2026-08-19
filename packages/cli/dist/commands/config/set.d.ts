import { Command } from '@oclif/core';
export default class ConfigSet extends Command {
    static args: {
        readonly key: {
            readonly description: "Config key (e.g. apiKey, defaultEnvironment)";
            readonly name: "key";
            readonly required: true;
        };
        readonly value: {
            readonly description: "Config value";
            readonly name: "value";
            readonly required: true;
        };
    };
    static description: string;
    static flags: {
        global: import("@oclif/core/interfaces").BooleanFlag<boolean>;
    };
    run(): Promise<void>;
}
