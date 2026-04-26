#!/usr/bin/env bash
set -e

echo " Membuat struktur direktori..."
mkdir -p src/{models,views,controllers} bin defaults/{templates,snippets} .github/workflows

echo "📄 Membuat package.json..."
cat > package.json << 'EOF'
{
  "name": "@sismadi/readme-mvc",
  "version": "1.0.0",
  "description": "MVC-powered README generator for sismadi repositories",
  "type": "module",
  "main": "src/index.js",
  "bin": { "readme-mvc": "./bin/cli.js" },
  "exports": { ".": "./src/index.js", "./controllers": "./src/controllers/index.js" },
  "scripts": { "cli": "node bin/cli.js", "test": "node --test src/**/*.test.js" },
  "dependencies": { "commander": "^11.1.0", "zod": "^3.22.4" },
  "publishConfig": { "access": "public" },
  "keywords": ["readme", "generator", "mvc", "automation"],
  "author": "sismadi",
  "license": "MIT"
}
EOF

echo "🧠 Membuat Model Layer..."
cat > src/models/ConfigModel.js << 'EOF'
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

const RepoConfigSchema = z.object({
  template: z.enum(['lms-lib','lib-js','research-edu','generic']).default('generic'),
  description: z.string().max(160),
  topics: z.array(z.string()).min(1).max(20),
  features: z.array(z.string()).optional(),
  install: z.object({ npm: z.string().optional(), cdn: z.string().optional() }).optional(),
  license: z.string().default('MIT')
});

export class ConfigModel {
  constructor(basePath = './config') { this.basePath = basePath; this._cache = new Map(); }

  async loadProfile() {
    if (this._cache.has('profile')) return this._cache.get('profile');
    const defaultProfile = { author: { name: 'sismadi', username: 'sismadi' }, badges: { license: 'MIT' } };
    this._cache.set('profile', defaultProfile);
    return defaultProfile;
  }

  async loadRepoConfig(repoName, configPath = './readme-mvc.config.json') {
    try {
      const raw = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      return { name: repoName, ...RepoConfigSchema.parse(raw) };
    } catch (err) {
      throw new Error(`Config invalid/missing for '${repoName}': ${err.message}`);
    }
  }

  async buildContext(repoName, options = {}) {
    const [profile, repoConfig] = await Promise.all([this.loadProfile(), this.loadRepoConfig(repoName, options.configPath)]);
    return { ...profile, ...repoConfig, generated_at: new Date().toISOString(), ...options.overrides };
  }
}
EOF

echo " Membuat View Layer..."
cat > src/views/TemplateEngine.js << 'EOF'
import fs from 'fs/promises';
import path from 'path';

export class TemplateEngine {
  constructor(snippetsDir = './defaults/snippets') { this.snippetsDir = snippetsDir; this._cache = new Map(); }

  async _resolve(type, name, localBase = './') {
    const paths = [
      path.resolve(localBase, `${type}s/${name}.md`),
      path.resolve(process.cwd(), `defaults/${type}s/${name}.md`)
    ];
    for (const p of paths) { try { await fs.access(p); return p; } catch { continue; } }
    throw new Error(`${type} '${name}' not found`);
  }

  async loadSnippet(name, localBase = './') {
    if (this._cache.has(name)) return this._cache.get(name);
    try {
      const content = await fs.readFile(await this._resolve('snippet', name, localBase), 'utf-8');
      const processed = await this._injectPartials(content, localBase);
      this._cache.set(name, processed);
      return processed;
    } catch { return `<!-- Snippet ${name} missing -->`; }
  }

  async _injectPartials(content, localBase) {
    let result = content;
    for (const m of content.matchAll(/\{\{>\s*([\w-]+)\s*\}\}/g)) {
      result = result.replace(m[0], await this.loadSnippet(m[1], localBase));
    }
    return result;
  }

  async render(templateName, context, localBase = './') {
    let tmpl = await fs.readFile(await this._resolve('template', templateName, localBase), 'utf-8');
    let out = await this._injectPartials(tmpl, localBase);
    out = out.replace(/\{([\w.]+)\}/g, (_, k) => {
      const v = k.split('.').reduce((o, p) => o?.[p], context);
      return v !== undefined ? String(v).replace(/[<>[\]]/g, '\\$&') : `{${k}}`;
    });
    out = out.replace(/\{#each\s+([\w.]+)\}([\s\S]*?)\{\/each\}/g, (_, k, block) => {
      const list = k.split('.').reduce((o, p) => o?.[p], context) || [];
      return Array.isArray(list) ? list.map(i => block.replace(/\{item\}/g, i).replace(/\{index\}/g, list.indexOf(i)+1)).join('\n') : '';
    });
    out = out.replace(/\{#if\s+([\w.]+)\}([\s\S]*?)(?:\{#else\}([\s\S]*?))?\{\/if\}/g, (_, k, ifB, elseB='') => {
      const v = k.split('.').reduce((o, p) => o?.[p], context);
      return (v ? ifB : elseB).trim();
    });
    return out.trim();
  }
}
EOF

echo "🎮 Membuat Controller Layer..."
cat > src/controllers/CLIController.js << 'EOF'
import { Command } from 'commander';
import { ConfigModel } from '../models/ConfigModel.js';
import { TemplateEngine } from '../views/TemplateEngine.js';
import fs from 'fs/promises';
import path from 'path';

export class CLIController {
  constructor(opts = {}) {
    this.program = new Command().name('readme-mvc').description('MVC README Generator').version('1.0.0');
    this.config = new ConfigModel(opts.configPath || './config');
    this.view = new TemplateEngine(opts.snippetsPath || './defaults/snippets');
    this._setup();
  }
  _setup() {
    this.program
      .command('generate <repo>')
      .option('-o, --output <file>', 'README.md')
      .option('-T, --template <name>')
      .option('-f, --force')
      .option('--config-path <path>', './readme-mvc.config.json')
      .action(async (repo, o) => await this._run(repo, o));
  }
  async _run(repo, opts) {
    try {
      console.log(`📦 Loading config for ${repo}...`);
      const ctx = await this.config.buildContext(repo, { configPath: opts.configPath });
      console.log(` Rendering template: ${ctx.template}...`);
      const md = await this.view.render(opts.template || ctx.template, ctx);
      const outPath = path.resolve(opts.output);
      if (await fs.access(outPath).then(()=>true).catch(()=>false) && !opts.force) {
        console.warn(`️  ${outPath} exists. Use --force to overwrite.`); return;
      }
      await fs.writeFile(outPath, md, 'utf-8');
      console.log(`✅ Generated: ${outPath}`);
    } catch (err) { console.error(`❌ ${err.message}`); process.exit(1); }
  }
  run() { this.program.parse(process.argv); }
}
EOF

echo "🔗 Membuat Public API & CLI Entry..."
cat > src/index.js << 'EOF'
export { ConfigModel } from './models/ConfigModel.js';
export { TemplateEngine } from './views/TemplateEngine.js';
export { CLIController } from './controllers/CLIController.js';
export async function generateReadme(repo, opts={}) {
  const c = new ConfigModel(opts.configPath);
  const v = new TemplateEngine(opts.snippetsPath);
  const ctx = await c.buildContext(repo, opts.overrides);
  return v.render(opts.template || ctx.template, ctx);
}
EOF

cat > bin/cli.js << 'EOF'
#!/usr/bin/env node
import { CLIController } from '../src/controllers/CLIController.js';
new CLIController().run();
EOF
chmod +x bin/cli.js

echo "📝 Membuat Default Templates & Snippets..."
cat > defaults/templates/lms-lib.md << 'EOF'
# {repo}

{description}

{{> header}}

##  Features
{#each features}
- {item}
{/each}

## 📦 Installation
{#if install.npm}
\`\`\`bash
npm install {repo}
\`\`\`
{/if}

## 💡 Usage
\`\`\`javascript
import { something } from '{repo}';
// ...
\`\`\`

{{> donatjs-integration}}

## 📄 License
{license} © {author.username}

{{> footer}}
EOF

cat > defaults/snippets/header.md << 'EOF'
[![License: {badges.license}](https://img.shields.io/badge/License-{badges.license}-yellow.svg)](LICENSE)
> **Author:** [{author.name}](https://github.com/{author.username}) | **Generated:** {generated_at}
EOF

cat > defaults/snippets/footer.md << 'EOF'
---
<p align="center">Built with ❤️ by <a href="https://github.com/sismadi">sismadi</a></p>
EOF

cat > defaults/snippets/donatjs-integration.md << 'EOF'
## 🔌 DonatJS Integration
Compatible with DonatJS module system. Load as dependency in your `dataset.js` or custom module loader.
EOF

echo "⚙️ Membuat Reusable GitHub Action..."
cat > .github/workflows/reusable-sync.yml << 'EOF'
name: README MVC Sync
on:
  workflow_call:
    inputs:
      repo_name: { required: true, type: string }
      config_path: { default: './readme-mvc.config.json', type: string }
      output_path: { default: 'README.md', type: string }
      github_token: { required: true, type: string }
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '18', cache: 'npm' }
      - run: npm ci
      - run: npx readme-mvc generate ${{ inputs.repo_name }} --config-path ${{ inputs.config_path }} --output ${{ inputs.output_path }} --force
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add ${{ inputs.output_path }}
          git diff --quiet && exit 0
          git commit -m "🤖 Auto-sync README [skip ci]"
          git push
        env: { GITHUB_TOKEN: ${{ inputs.github_token }} }
EOF

echo "✅ Setup selesai! Struktur readme-mvc siap digunakan."
