export { ConfigModel } from './models/ConfigModel.js';
export { TemplateEngine } from './views/TemplateEngine.js';
export { CLIController } from './controllers/CLIController.js';

import { ConfigModel } from './models/ConfigModel.js';
import { TemplateEngine } from './views/TemplateEngine.js';

export async function generateReadme(repoName, options = {}) {
  const config = new ConfigModel(options.configPath);
  const engine = new TemplateEngine(options.snippetsPath);
  
  const context = await config.buildContext(repoName, options.overrides);
  const template = options.template || context.template;
  
  return await engine.render(template, context);
}

export default { generateReadme, ConfigModel, TemplateEngine, CLIController };
