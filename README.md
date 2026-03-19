# Form Tester

AI-powered testing skill for `/skjemautfyller` forms using [Playwright CLI](https://www.npmjs.com/package/@playwright/cli). Works with **Claude Code** and **GitHub Copilot**.

## Quick Install

```bash
npx form-tester install
```

This installs skill files into your project:
- `.claude/skills/form-tester/` — Claude Code skill
- `.claude/skills/playwright-cli/` — Playwright CLI skill
- `.github/copilot-instructions.md` — GitHub Copilot instructions
- `form-tester.config.example.json` — Config template

## Prerequisites

- Node.js 18+
- [Playwright CLI](https://www.npmjs.com/package/@playwright/cli)

```bash
npm install -g @playwright/cli@latest
playwright-cli install --skills
```

## Configuration

```bash
cp form-tester.config.example.json form-tester.config.json
```

Edit `form-tester.config.json` and set your `pnr`.

## Usage

### Claude Code

The skill is automatically detected when you open the project in Claude Code. Use the `/form-tester` skill or run:

```bash
npx form-tester
```

### GitHub Copilot

Copilot reads instructions from `.github/copilot-instructions.md` automatically. Open the project in VS Code with Copilot enabled.

### Standalone CLI

```bash
npx form-tester
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
