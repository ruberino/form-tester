# Form Tester

AI-powered testing skill for `/skjemautfyller` forms using [Playwright CLI](https://www.npmjs.com/package/@playwright/cli). Works with **Claude Code** and **GitHub Copilot**.

## Prerequisites

- Node.js 18+
- [Playwright CLI](https://www.npmjs.com/package/@playwright/cli)

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_ORG/form-tester.git
cd form-tester
```

### 2. Install Playwright CLI

```bash
npm run setup
# or manually:
npm install -g @playwright/cli@latest
playwright-cli install --skills
```

### 3. Configure

```bash
cp form-tester.config.example.json form-tester.config.json
```

Edit `form-tester.config.json` and set your `pnr`.

## Usage

### Claude Code

The skill is automatically detected when you open this directory in Claude Code. Use the `/form-tester` skill or run:

```bash
node form-tester.js
```

### GitHub Copilot

Copilot reads instructions from `.github/copilot-instructions.md` automatically. Open this directory in VS Code with Copilot enabled — it will have context on the form-tester commands and workflow.

### Standalone CLI

```bash
node form-tester.js
```

Commands: `/setup`, `/update`, `/version`, `/people`, `/test {url}`, `/save {label}`, `/clear`, `/quit`

Use `--help` for the full command list.

## Test Output

Test runs are saved to `output/{form-id}/{timestamp}/` with:
- Snapshots (YAML)
- Screenshots (PNG, full-page)
- `test_results.txt`

## Development

```bash
npm test
```

## License

MIT
