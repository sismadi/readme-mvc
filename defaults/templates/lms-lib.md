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
npm install {repo}
```
{/if}

## 💡 Usage

```javascript
import { repo } from '{repo}';
```

{{> donatjs-integration}}

## 📄 License

{license} © {author.username}

{{> footer}}
