# {repo}

{description}

{{> header}}

## ✨ Features

{#each features}
- {item}
{/each}

## 📦 Installation

{#if install.npm}
```bash
npm install {install.npm}
```
{/if}

## 💡 Usage

```javascript
import { repo } from '{repo}';
```

{{> donatjs-integration}}

## 🌐 Social & Links

{#if social.twitter}
- Twitter: {social.twitter}
{/if}

{#if social.website}
- Website: {social.website}
{/if}

## 📄 License

{license} © {author.username}

{{> footer}}
