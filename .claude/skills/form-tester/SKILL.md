---
name: form-tester
description: Runs the form-tester CLI to test /skjemautfyller forms via Playwright CLI and exposes playwright-cli commands.
allowed-tools: Bash(powershell:*), Bash(playwright-cli:*), Bash(form-tester:*)
---

# Form Tester CLI

## Quick start

```bash
# One-time install (user runs this manually):
npm install -g form-tester

# Install skill files into project:
form-tester install
form-tester install --global   # or install to ~/.claude/skills/

# Non-interactive mode (no prompts, best for AI agents):
form-tester test <url> --auto
form-tester test <url> --auto --pnr 12345 --persona ung-mann --scenario "test validation"

# Human mode (user picks persona and scenario):
form-tester test <url> --human                                          # lists personas, ask user
form-tester test <url> --human --persona ung-mann --scenario "test X"   # run with user's choices

# Full interactive CLI:
form-tester
```

Persona IDs: `ung-mann`, `gravid-kvinne`, `eldre-kvinne`, `kronisk-syk-mann`. Defaults to "noen" (neutral answers) if omitted.

## Recording & Replay

Every test run records all commands to `recording.json` in the output folder. To ensure ALL commands are recorded (including form filling, clicking, etc.), always use `form-tester exec` instead of `playwright-cli` directly:

```bash
# ALWAYS use this instead of playwright-cli directly:
form-tester exec fill e1 "value"
form-tester exec click e3
form-tester exec screenshot --filename "path.png" --full-page
form-tester exec close    # finalizes and saves the recording
```

Replay a previous run:
```bash
form-tester replay output/form-id/timestamp/recording.json
```

## Document verification

After form submission, use the standardized documents command:
```bash
form-tester documents        # auto-navigates, detects PDF/HTML, captures
```
This handles the full flow: navigate to Dokumenter, find latest doc, detect format, download PDF or screenshot HTML.

## Issue logging

When something unexpected happens during a test, log it for skill improvement:
```bash
form-tester issue <category> "<description>"
form-tester issues              # view recent issues
```
Categories: `person-selection`, `navigation`, `form-fill`, `submission`, `documents`, `pdf-download`, `html-capture`, `screenshot`, `snapshot`, `validation`, `modal`, `timeout`, `other`

## Interactive commands

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

IMPORTANT: Always use `form-tester exec` instead of `playwright-cli` directly. This ensures all commands are recorded for replay. The syntax is the same — just prefix with `form-tester exec`:

```bash
form-tester exec snapshot
form-tester exec fill e1 "value"
form-tester exec click e3
form-tester exec screenshot --filename "page.png" --full-page
form-tester exec close
```
