import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { select, input } from '@inquirer/prompts';
import path from 'node:path';
import fs from 'fs-extra';
import ora from 'ora';
import { AuthService } from '../services/auth.service.js';
import { CloudService } from '../services/cloud.service.js';
import AuthLogin from './auth/login.js';
export default class Init extends Command {
    static description = 'Initialize Capucho in this project';
    static flags = {
        link: Flags.boolean({
            char: 'l',
            default: false,
            description: 'Link to existing app instead of creating new one',
        }),
    };
    async run() {
        const { flags } = await this.parse(Init);
        const root = process.cwd();
        const authService = new AuthService(root);
        const cloudService = new CloudService(root);
        // Header
        this.log('');
        this.log(chalk.cyan('╔═══════════════════════════════════════════╗'));
        this.log(chalk.cyan('║') + chalk.bold('       Initialize Capucho Project          ') + chalk.cyan('║'));
        this.log(chalk.cyan('╚═══════════════════════════════════════════╝'));
        this.log('');
        // 1. Check if already initialized
        const configPath = path.join(root, '.capucho', 'project.json');
        if (await fs.pathExists(configPath)) {
            const existing = (await fs.readJson(configPath));
            this.log(chalk.yellow('  ⚠️  Project already initialized!'));
            this.log(chalk.gray(`     App: ${existing.appName} (${existing.cloudAppId})`));
            this.log('');
            const action = await select({
                message: 'What would you like to do?',
                choices: [
                    { name: 'Keep current configuration', value: 'keep' },
                    { name: 'Re-initialize (unlink and start over)', value: 'reinit' },
                    { name: 'Exit', value: 'exit' },
                ],
            });
            if (action === 'exit')
                return;
            if (action === 'keep') {
                this.log(chalk.green('  ✓ Using existing configuration\n'));
                return;
            }
        }
        // 2. Check authentication or trigger login
        const { valid, user: loggedInUser } = await authService.verifyCredentials();
        if (!valid) {
            this.log(chalk.yellow("  👋  Welcome to Capucho! Let's get you signed in."));
            this.log(chalk.gray('      We need an API key to link this project to your account.\n'));
            try {
                await AuthLogin.performLogin(root);
            }
            catch {
                this.error(chalk.red('Authentication failed. Please try again.'));
            }
        }
        // Re-verify after potential login
        const { user } = await authService.verifyCredentials();
        this.log(chalk.gray(`  Logged in as: ${user?.email}`));
        this.log('');
        // 3. New app or link existing?
        let projectConfig;
        if (flags.link) {
            projectConfig = await this.linkExistingApp(cloudService);
        }
        else {
            const choice = await select({
                message: 'How would you like to start?',
                choices: [
                    { name: '🆕  Create new app in cloud', value: 'new' },
                    { name: '🔗  Link to existing app', value: 'existing' },
                ],
            });
            if (choice === 'existing') {
                projectConfig = await this.linkExistingApp(cloudService);
            }
            else {
                projectConfig = await this.createNewApp(cloudService);
            }
        }
        // 4. Save project config
        await fs.ensureDir(path.dirname(configPath));
        await fs.outputJson(configPath, projectConfig, { spaces: 2 });
        // 5. Success!
        this.log('');
        this.log(chalk.green('╔═══════════════════════════════════════════╗'));
        this.log(chalk.green('║') + chalk.bold('        Initialization Complete! 🎉        ') + chalk.green('║'));
        this.log(chalk.green('╚═══════════════════════════════════════════╝'));
        this.log('');
        this.log(chalk.cyan(`  App:        ${projectConfig.appName}`));
        this.log(chalk.cyan(`  Bundle ID:  ${projectConfig.appId}`));
        this.log(chalk.cyan(`  Cloud ID:   ${projectConfig.cloudAppId}`));
        this.log(chalk.gray(`  Config:     .capucho/project.json`));
        this.log('');
        this.log(chalk.green('✓ Ready to deploy!'));
        this.log(chalk.gray('  Run: ') + chalk.cyan('capucho deploy ota'));
        this.log('');
        // 6. Fetch and show available channels/flavors
        await this.showProjectInfo(cloudService, projectConfig.cloudAppId);
    }
    async createNewApp(cloudService) {
        this.log(chalk.cyan('\n📝 Create New App\n'));
        const orgSpinner = ora('Fetching your organizations...').start();
        let orgs = [];
        try {
            orgs = await cloudService.getOrganizations();
            orgSpinner.stop();
        }
        catch (error) {
            orgSpinner.fail('Failed to fetch organizations');
            throw error;
        }
        // Filter organizations where the user has permission to create apps
        const adminOrgs = orgs.filter((org) => ['owner', 'admin'].includes(org.role));
        if (adminOrgs.length === 0) {
            this.log(chalk.yellow("  ⚠️  You don't have permission to create apps in any organization."));
            this.log(chalk.gray('     Please contact your organization owner.\n'));
            process.exit(0);
        }
        let selectedOrgId = adminOrgs[0].id;
        if (adminOrgs.length > 1) {
            selectedOrgId = await select({
                message: 'Select Organization:',
                choices: adminOrgs.map((org) => ({
                    name: `${org.name} (${org.role})`,
                    value: org.id,
                })),
            });
        }
        else {
            this.log(chalk.gray(`  Organization: ${adminOrgs[0].name} (${adminOrgs[0].role})`));
        }
        const appName = await input({
            message: 'App Name (user-friendly):',
            default: path.basename(process.cwd()),
            validate: (value) => value.length > 0 || 'App name required',
        });
        const appId = await input({
            message: 'Bundle Identifier (e.g., com.company.app):',
            validate: (value) => /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(value) || 'Invalid bundle ID format',
        });
        const spinner = ora('Creating app in cloud...').start();
        try {
            const cloudApp = await cloudService.createApp({
                name: appName,
                app_id: appId, // Use app_id as expected by backend
                platform: 'android',
                organization_id: selectedOrgId,
            });
            spinner.succeed('App created successfully!');
            return {
                appId,
                cloudAppId: cloudApp.id,
                appName: appName,
                createdAt: new Date().toISOString(),
            };
        }
        catch (error) {
            spinner.fail('Failed to create app');
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.error(chalk.red(`\n  Error: ${errorMessage}`));
        }
    }
    async linkExistingApp(cloudService) {
        this.log(chalk.cyan('\n🔗 Link to Existing App\n'));
        const spinner = ora('Fetching your apps...').start();
        try {
            const apps = await cloudService.getApps();
            spinner.stop();
            if (apps.length === 0) {
                this.log(chalk.yellow('  ⚠️  No apps found in your account.'));
                this.log(chalk.gray('     Create one in the dashboard or via CLI.\n'));
                process.exit(0);
            }
            const selectedApp = await select({
                message: 'Select app to link:',
                choices: apps.map((app) => ({
                    name: `${app.name} (${app.app_id})`,
                    value: app,
                })),
            });
            return {
                appId: selectedApp.app_id,
                cloudAppId: selectedApp.id,
                appName: selectedApp.name,
                createdAt: new Date().toISOString(),
            };
        }
        catch (error) {
            spinner.fail('Failed to fetch apps');
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.error(chalk.red(`\n  Error: ${errorMessage}`));
        }
    }
    async showProjectInfo(cloudService, cloudAppId) {
        const spinner = ora('Fetching channels...').start();
        try {
            const channels = await cloudService.getChannels(cloudAppId);
            spinner.stop();
            if (channels.length > 0) {
                this.log(chalk.bold('  Channels:'));
                for (const channel of channels) {
                    this.log(`    • ${channel.name} ${chalk.gray(channel.public ? '(public)' : '(private)')}`);
                }
                this.log('');
            }
            if (channels.length === 0) {
                this.log(chalk.gray('  No channels configured yet.'));
                this.log(chalk.gray('  Configure them in the dashboard.\n'));
            }
        }
        catch {
            spinner.stop();
        }
    }
}
