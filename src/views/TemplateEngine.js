import fs from 'fs/promises';
import path from 'path';

export class TemplateEngine {
  constructor(snippetsDir = './defaults/snippets') {
    this.snippetsDir = snippetsDir;
    this._snippetCache = new Map();
  }

  async resolvePath(type, name, localBase = './') {
    const paths = [
      path.resolve(localBase, `${type}s/${name}.md`),
      path.resolve(process.cwd(), `defaults/${type}s/${name}.md`)
    ];

    for (const p of paths) {
      try {
        await fs.access(p);
        return p;
      } catch {
        continue;
      }
    }
    throw new Error(`${type} '${name}' not found in local or defaults`);
  }

  async loadSnippet(name, localBase = './') {
    if (this._snippetCache.has(name)) {
      return this._snippetCache.get(name);
    }
    
    try {
      const snippetPath = await this.resolvePath('snippet', name, localBase);
      let content = await fs.readFile(snippetPath, 'utf-8');
      content = await this._injectPartials(content, localBase);
      this._snippetCache.set(name, content);
      return content;
    } catch (error) {
      return `<!-- Snippet '${name}' not found -->`;
    }
  }

  async _injectPartials(content, localBase) {
    const partialRegex = /\{\{>\s*([\w-]+)\s*\}\}/g;
    let result = content;
    
    for (const match of content.matchAll(partialRegex)) {
      const partial = await this.loadSnippet(match[1], localBase);
      result = result.replace(match[0], partial);
    }
    return result;
  }

  async render(templateName, context, localBase = './') {
    try {
      const templatePath = await this.resolvePath('template', templateName, localBase);
      let template = await fs.readFile(templatePath, 'utf-8');
      
      // Inject snippets
      let output = await this._injectPartials(template, localBase);
      
      // Variable substitution
      output = output.replace(/\{([\w.]+)\}/g, (_, key) => {
        const value = key.split('.').reduce((obj, k) => obj?.[k], context);
        return value !== undefined ? this._escapeMarkdown(value) : `{${key}}`;
      });
      
      // Process loops
      output = this._processLoops(output, context);
      
      // Process conditionals
      output = this._processConditionals(output, context);
      
      return output.trim();
    } catch (error) {
      throw new Error(`Failed to render template '${templateName}': ${error.message}`);
    }
  }

  _processLoops(content, context) {
    return content.replace(
      /\{#each\s+([\w.]+)\}([\s\S]*?)\{\/each\}/g,
      (_, listKey, block) => {
        const list = listKey.split('.').reduce((obj, k) => obj?.[k], context) || [];
        if (!Array.isArray(list)) return '';
        
        return list.map((item, idx) => 
          block
            .replace(/\{item\}/g, this._escapeMarkdown(item))
            .replace(/\{index\}/g, idx + 1)
            .replace(/\{(\w+)\}/g, (_, prop) => 
              typeof item === 'object' ? this._escapeMarkdown(item[prop]) : ''
            )
        ).join('\n');
      }
    );
  }

  _processConditionals(content, context) {
    return content.replace(
      /\{#if\s+([\w.]+)\}([\s\S]*?)(?:\{#else\}([\s\S]*?))?\{\/if\}/g,
      (_, conditionKey, ifBlock, elseBlock = '') => {
        const value = conditionKey.split('.').reduce((obj, k) => obj?.[k], context);
        return (value ? ifBlock : elseBlock).trim();
      }
    );
  }

  _escapeMarkdown(value) {
    if (typeof value !== 'string') return String(value);
    return value.replace(/[<>[\]]/g, '\\$&');
  }
}
