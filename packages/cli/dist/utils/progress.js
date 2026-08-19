import cliProgress from 'cli-progress';
import ora from 'ora';
import chalk from 'chalk';
export class MultiStepProgress {
    multibar;
    progressBar = null;
    spinner;
    totalSteps = 0;
    currentStep = 0;
    constructor() {
        this.multibar = new cliProgress.MultiBar({
            hideCursor: true,
            format: ` {bar} | {percentage}% | {value}/{total} Steps | ${chalk.cyan('{message}')}`,
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
        }, cliProgress.Presets.shades_classic);
        this.spinner = ora();
    }
    start(totalSteps, initialMessage) {
        this.totalSteps = totalSteps;
        this.currentStep = 1;
        this.progressBar = this.multibar.create(totalSteps, 1, { message: initialMessage });
        this.spinner.start(initialMessage);
    }
    nextStep(message) {
        // Persist previous step as success
        this.spinner.succeed(chalk.green(this.spinner.text));
        this.currentStep++;
        if (this.progressBar) {
            this.progressBar.update(this.currentStep, { message });
        }
        // Start new spinner for current step
        this.spinner = ora().start(message);
    }
    updateMessage(message) {
        if (this.progressBar) {
            this.progressBar.update(this.currentStep, { message });
        }
        this.spinner.text = message;
    }
    finish(message) {
        this.spinner.succeed(chalk.green(this.spinner.text));
        if (this.progressBar) {
            this.progressBar.update(this.totalSteps, { message });
        }
        this.multibar.stop();
        console.log('\n' + chalk.green('✓ ' + message));
    }
    fail(message) {
        this.spinner.fail(chalk.red(this.spinner.text));
        this.multibar.stop();
        console.error('\n' + chalk.red('✖ ' + message));
    }
}
