import { Command } from '@oclif/core';
export default class Init extends Command {
    static description: string;
    static flags: {
        link: import("@oclif/core/interfaces").BooleanFlag<boolean>;
    };
    run(): Promise<void>;
    private createNewApp;
    private linkExistingApp;
    private showProjectInfo;
}
