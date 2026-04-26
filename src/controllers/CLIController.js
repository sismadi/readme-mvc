import { Command } from 'commander';
import { ConfigModel } from '../models/ConfigModel.js';
import { TemplateEngine } from '../views/TemplateEngine.js';
import fs from 'fs/promises';
import path from 'path';

export class CLIController {
  constructor(options = {}) {
    this.program = new Command();
    this.config = new ConfigModel(options.configPath || './config');
    this.view = new TemplateEngine(options.snippetsPath || './defaults/snippets');
    this._setupCommands();
  }

  _setupCommands() {
    this.program
      .name('readme-mvc')
      .description('🤖 MVC-powered README generator')
      .version('1.0.0')
      .option('-c, --config <path>', 'Config directory', './config')
      .option('-d, --dry-run', 'Preview without writing');

    this.program
      .command('generate <repo>')
      .description('Generate README for specified repository')
      .option('-o, --output <file>', 'Output file path', 'README.md')
      .option('-T, --template <name>', 'Override template')
      .option('-f, --force', 'Overwrite existing file')
      .option('--config-path <path>', 'Path to config file', './readme-mvc.config.json')
      .action(async (repo, cmdOpts) => {
        await this.handleGenerate(repo, { ...cmdOpts, ...this.program.opts() });
      });

    this.program
      .command('validate <repo>')
      .description('Validate config completeness')
      .option('--config-path <path>', 'Path to config file', './readme-mvc.config.json')
      .action(async (repo, cmdOpts) => {
        await this.handleValidate(repo, cmdOpts);
      });
  }

  async handleGenerate(repoName, options) {
    try {
      console.log(`📦 Loading config for ${repoName}...`);
      const context = await this.config.buildContext(repoName, {
        configPath: options.configPath
      });

      console.log(`🎨 Rendering with template: ${context.template}...`);
      const template = options.template || context.template;
      const output = await this.view.render(template, context);

      if (options.dryRun) {
        console.log('🔍 [DRY RUN] Preview output:');
        console.log('─'.repeat(60));
        console.log(output);
        return;
      }

      const outputPath = path.resolve(options.output);
      if (await this._fileExists(outputPath) && !options.force) {
        console.warn(`⚠️  File exists: ${outputPath}. Use --force to overwrite.`);
        return;
      }
      
      await fs.writeFile(outputPath, output, 'utf-8');
      console.log(`✅ README generated: ${outputPath}`);

    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  async handleValidate(repoName, options) {
    console.log(`🔍 Validating config for ${repoName}...`);
    
    try {
      const config = await this.config.loadRepoConfig(repoName, options.configPath);
      
      if (!config.template) {
        throw new Error('Template not specified in config');
      }
      
      console.log('✅ Validation passed!');
      console.log(`   Template: ${config.template}`);
      console.log(`   Topics: ${config.topics.join(', ')}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Validation failed: ${error.message}`);
      process.exit(1);
    }
  }

  async _fileExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  run() {
    this.program.parse(process.argv);
  }
}
