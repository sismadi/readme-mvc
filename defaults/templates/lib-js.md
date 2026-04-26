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

## 🌐 Social & Links

{#if social.twitter}
- **Twitter:** [{social.twitter}](https://twitter.com/{social.twitter})
{/if}
{#if social.instagram}
- **Instagram:** [{social.instagram}](https://instagram.com/{social.instagram})
{/if}
{#if social.website}
- **Website:** [{social.website}]({social.website})
{/if}
## 📄 License

{license} © {author.username}

{{> footer}}
