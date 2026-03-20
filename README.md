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

### Test modes

```bash
# AI mode (default) — no prompts, uses defaults:
form-tester test <url> --auto
form-tester test <url> --auto --pnr 12345 --persona ung-mann --scenario "test validation"

# Human mode — prompts for persona, scenario, person selection:
form-tester test <url> --human

# Full interactive CLI:
form-tester
```

Persona IDs: `ung-mann`, `gravid-kvinne`, `eldre-kvinne`, `kronisk-syk-mann`

### Recording & Replay

Every test run records all commands to `recording.json`. Use `form-tester exec` instead of `playwright-cli` to ensure all commands are recorded:

```bash
form-tester exec fill e1 "value"
form-tester exec click e3
form-tester exec screenshot --filename "page.png" --full-page
form-tester exec close           # finalizes recording
```

Replay a previous run:
```bash
form-tester replay output/form-id/timestamp/recording.json
```

### Interactive CLI

Full interactive CLI with all commands:

```bash
form-tester
```

Commands: `/setup`, `/update`, `/version`, `/people`, `/test {url}`, `/save {label}`, `/clear`, `/quit`

### Claude Code

After `form-tester install`, the skill is automatically detected. Use the `/form-tester` skill or just ask Claude to test a form.

If the skill isn't showing up:
1. Make sure `.claude/skills/form-tester/` exists in your project (run `form-tester install`)
2. Restart Claude Code or start a new conversation

### GitHub Copilot

After `form-tester install`, Copilot reads `.github/copilot-instructions.md` and `.claude/skills/` automatically.

If Copilot doesn't recognize the skill:
1. Make sure `.claude/skills/form-tester/` exists in your project (run `form-tester install`)
2. Run `/skills` in the Copilot CLI to reload skills, or restart the session

## Skip permission prompts

By default, AI agents will ask permission for every shell command. To run without interruptions, pre-allow the relevant tools.

### Claude Code

Add to your project's `.claude/settings.local.json` (or global `~/.claude/settings.json`):

```json
{
  "permissions": {
    "allow": [
      "Skill(form-tester)",
      "Bash(form-tester:*)",
      "Bash(playwright-cli:*)"
    ]
  }
}
```

Or use the Claude Code CLI:
```bash
claude config add permissions.allow "Skill(form-tester)"
claude config add permissions.allow "Bash(form-tester:*)"
claude config add permissions.allow "Bash(playwright-cli:*)"
```

### GitHub Copilot

In Copilot CLI, use auto-approve mode:
```bash
copilot --auto-approve
```

Or approve the tool categories when first prompted and select "Always allow".

## Test Output

Test runs are saved to `output/{form-id}/{timestamp}/` with:
- Snapshots (YAML)
- Screenshots (PNG, full-page)
- `test_results.txt`

### Dokumenter verification

After form submission, some forms store a copy in Dokumenter. The document type determines how to capture it:

- **PDF documents** — download the file directly (`playwright-cli pdf` or via browser download)
- **HTML documents** — take a full-page screenshot of the entire document (`playwright-cli screenshot --filename "..." --full-page`). HTML documents cannot be downloaded as-is, so the screenshot is the primary artifact.

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
