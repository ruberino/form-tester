# Form Tester

AI-powered testing skill for `/skjemautfyller` forms using [Playwright CLI](https://www.npmjs.com/package/@playwright/cli). Works with **Claude Code** and **GitHub Copilot**.

## Install

```bash
npm install -g form-tester
```

Then in your project:

```bash
form-tester install            # project-level (commits to repo)
form-tester install --global   # personal (~/.claude/skills/)
```

This installs:
- `.claude/skills/form-tester/` — Claude Code skill
- `.claude/skills/playwright-cli/` — Playwright CLI skill
- `.github/copilot-instructions.md` — GitHub Copilot instructions
- `form-tester.config.example.json` — Config template
- `playwright-cli` globally (if not already installed)

## Configuration

```bash
cp form-tester.config.example.json form-tester.config.json
```

Edit `form-tester.config.json` and set your `pnr`.

## Usage

### Non-interactive (recommended for AI agents)

```bash
form-tester test <url> --auto
form-tester test <url> --auto --pnr 12345 --persona ung-mann --scenario "test validation"
```

Persona IDs: `ung-mann`, `gravid-kvinne`, `eldre-kvinne`, `kronisk-syk-mann`

### Interactive CLI

```bash
form-tester
```

Commands: `/setup`, `/update`, `/version`, `/people`, `/test {url}`, `/save {label}`, `/clear`, `/quit`

### Claude Code

The skill is automatically detected when you open the project. Use the `/form-tester` skill.

### GitHub Copilot

Copilot reads instructions from `.github/copilot-instructions.md` automatically.

## Test Output

Test runs are saved to `output/{form-id}/{timestamp}/` with:
- Snapshots (YAML)
- Screenshots (PNG, full-page)
- `test_results.txt`

## Update

```bash
npm update -g form-tester
```

## Development

```bash
npm test
```

## License

MIT
