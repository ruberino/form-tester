---
name: form-tester
description: Runs the form-tester CLI to test /skjemautfyller forms via Playwright CLI and exposes playwright-cli commands.
allowed-tools: Bash(powershell:*), Bash(playwright-cli:*), Bash(npx form-tester:*)
---

# Form Tester CLI

## Quick start

```bash
npx form-tester install   # one-time setup
npx form-tester           # run the CLI
```

## Commands

```bash
/setup
/update
/version
/people
/test {url}
/save {label}
/clear
/quit
```

The CLI expects a single form URL. If `pnr` is missing, it will prompt for it.

Use `--help` or `-h` to print the command list without starting the prompt.

Run `/update` when you change the skill to update Playwright CLI + skills, and then reload the skill in Copilot CLI with `/skills` (reload) or `/restart`.

Use `/people` to rescan the visible person list and get a numbered selection prompt.

## Playwright CLI

You can also run `playwright-cli` commands directly when needed.

