import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix: Dapatkan direktori asli dari file ini agar path relatif selalu benar
// meskipun dipanggil dari folder lain
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOOL_ROOT = path.resolve(__dirname, '../..'); // Naik 2 level ke root readme-mvc

export class TemplateEngine {
  constructor(snippetsDir = null) {
    // Gunakan path absolut ke folder defaults milik tool ini
    this.defaultsDir = path.resolve(TOOL_ROOT, 'defaults');
    this.snippetsDir = snippetsDir || path.join(this.defaultsDir, 'snippets');
    this._cache = new Map();
  }

  async _resolve(type, name, localBase = './') {
    // 1. Cek override lokal (di repo yang sedang di-generate)
    const localPath = path.resolve(localBase, `${type}s/${name}.md`);
    
    // 2. Cek default bawaan tool (ini yang sebelumnya error)
    const defaultPath = path.resolve(this.defaultsDir, `${type}s/${name}.md`);

    // Coba akses file lokal dulu
    try {
      await fs.access(localPath);
      return localPath;
    } catch {
      // Jika tidak ada, coba akses default tool
      try {
        await fs.access(defaultPath);
        return defaultPath;
      } catch {
        throw new Error(`${type} '${name}' not found in local or defaults`);
      }
    }
  }

  async loadSnippet(name, localBase = './') {
    if (this._cache.has(name)) return this._cache.get(name);
    
    try {
      const resolvedPath = await this._resolve('snippet', name, localBase);
      let content = await fs.readFile(resolvedPath, 'utf-8');
      
      // Inject partials recursively
      const processed = await this._injectPartials(content, localBase);
      this._cache.set(name, processed);
      return processed;
    } catch (err) {
      return `<!-- Snippet ${name} not found -->`;
    }
  }

  async _injectPartials(content, localBase) {
    let result = content;
    // Regex untuk {{> snippet-name }}
    const partialRegex = /\{\{>\s*([\w-]+)\s*\}\}/g;
    
    for (const match of content.matchAll(partialRegex)) {
      const snippetName = match[1];
      const snippetContent = await this.loadSnippet(snippetName, localBase);
      result = result.replace(match[0], snippetContent);
    }
    return result;
  }

  async render(templateName, context, localBase = './') {
    try {
      const templatePath = await this._resolve('template', templateName, localBase);
      let template = await fs.readFile(templatePath, 'utf-8');
      
      let out = await this._injectPartials(template, localBase);

      // 1. Variable substitution {var}
      out = out.replace(/\{([\w.]+)\}/g, (_, k) => {
        const v = k.split('.').reduce((o, p) => o?.[p], context);
        return v !== undefined ? String(v).replace(/[<>[\]]/g, '\\$&') : `{${k}}`;
      });

      // 2. Loops {#each list}...{/each}
      out = out.replace(/\{#each\s+([\w.]+)\}([\s\S]*?)\{\/each\}/g, (_, k, block) => {
        const list = k.split('.').reduce((o, p) => o?.[p], context) || [];
        if (!Array.isArray(list)) return '';
        return list.map((i, idx) => 
          block
            .replace(/\{item\}/g, typeof i === 'object' ? JSON.stringify(i) : i)
            .replace(/\{index\}/g, idx + 1)
        ).join('\n');
      });

      // 3. Conditionals {#if var}...{/if}
      out = out.replace(/\{#if\s+([\w.]+)\}([\s\S]*?)(?:\{#else\}([\s\S]*?))?\{\/if\}/g, (_, k, ifB, elseB = '') => {
        const v = k.split('.').reduce((o, p) => o?.[p], context);
        return (v ? ifB : elseB).trim();
      });

      return out.trim();
    } catch (err) {
      throw new Error(`Render failed for '${templateName}': ${err.message}`);
    }
  }
}
