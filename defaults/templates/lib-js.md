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
// Initialize & use
```

{{> donatjs-integration}}

## 📄 License

{license} © {author.username}

{{> footer}}