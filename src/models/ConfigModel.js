import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export const ProfileSchema = z.object({
  author: z.object({
    name: z.string(),
    username: z.string(),
    avatar: z.string().url().optional(),
    bio: z.string().optional(),
    links: z.record(z.string().url()).optional()
  }),
  badges: z.object({
    donatjs: z.string().optional(),
    license: z.enum(['MIT','Apache-2.0','GPL-3.0']).default('MIT'),
    build: z.string().optional()
  }),
  defaults: z.object({
    language: z.string().default('id'),
    timezone: z.string().default('Asia/Jakarta')
  }).optional()
});

export const RepoConfigSchema = z.object({
  template: z.enum(['lms-lib','lib-js','research-edu','generic']).default('generic'),
  description: z.string().max(160),
  topics: z.array(z.string()).min(1).max(20),
  features: z.array(z.string()).optional(),
  install: z.object({
    npm: z.string().optional(),
    cdn: z.string().optional(),
    manual: z.array(z.string()).optional()
  }).optional(),
  requirements: z.array(z.string()).optional(),
  license: z.string().default('MIT'),
  contributors: z.array(z.object({
    username: z.string(),
    role: z.string()
  })).optional()
});

export class ConfigModel {
  constructor(basePath = './config') {
    this.basePath = basePath;
    this._cache = new Map();
  }

  async loadProfile() {
    if (this._cache.has('profile')) return this._cache.get('profile');
    
    try {
      const profilePath = path.join(this.basePath, 'profile.json');
      const raw = JSON.parse(await fs.readFile(profilePath, 'utf-8'));
      const validated = ProfileSchema.parse(raw);
      this._cache.set('profile', validated);
      return validated;
    } catch (error) {
      // Return default profile if not exists
      const defaultProfile = {
        author: { name: 'sismadi', username: 'sismadi' },
        badges: { license: 'MIT' },
        defaults: { language: 'id', timezone: 'Asia/Jakarta' }
      };
      this._cache.set('profile', defaultProfile);
      return defaultProfile;
    }
  }

  async loadRepoConfig(repoName, configPath = './readme-mvc.config.json') {
    try {
      const raw = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      const validated = RepoConfigSchema.parse(raw);
      return { name: repoName, ...validated };
    } catch (error) {
      throw new Error(`Config not found or invalid for repo: ${repoName}. Error: ${error.message}`);
    }
  }

  async buildContext(repoName, runtimeOptions = {}) {
    const [profile, repoConfig] = await Promise.all([
      this.loadProfile(),
      this.loadRepoConfig(repoName, runtimeOptions.configPath)
    ]);

    return {
      author: profile.author,
      badges: profile.badges,
      repo: repoName,
      ...repoConfig,
      generated_at: new Date().toISOString(),
      donatjs_version: 'latest',
      ...runtimeOptions.overrides
    };
  }
}
