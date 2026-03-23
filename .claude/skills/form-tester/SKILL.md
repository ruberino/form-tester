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

# Non-interactive mode — accepts form name, path, or full URL:
form-tester test SLV-PasRapp-2020 --auto
form-tester test SLV-PasRapp-2020 --auto --pnr 12345 --persona ung-mann
form-tester test https://example.com/skjemautfyller/FORM --auto

# Human mode (user picks persona and scenario):
form-tester test SLV-PasRapp-2020 --human                                  # lists personas
form-tester test SLV-PasRapp-2020 --human --persona ung-mann --scenario "X" # with choices

# Check URL resolution:
form-tester url SLV-PasRapp-2020

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

## Standardized commands

Use these instead of manual steps — they handle retries, edge cases, and error logging automatically:

```bash
form-tester cookies                    # dismiss cookie banner (tries known selectors)
form-tester select-person              # select recommended person ("Uromantisk Direktør")
form-tester select-person "Name"       # select specific person by name
form-tester validate                   # parse validation errors, scroll to each field, show context
form-tester documents                  # navigate to Dokumenter, detect PDF/HTML, capture
form-tester issue <category> "<text>"  # log an issue for skill improvement
form-tester issues                     # view recent issues
```

### Typical test flow:
1. `form-tester test <url> --auto` — open form
2. `form-tester cookies` — dismiss cookies
3. `form-tester select-person` — select person
4. Fill the form with `form-tester exec fill/click/select`
5. Submit, then `form-tester validate` — find and fix any validation errors
6. `form-tester documents` — verify document after successful submission
7. `form-tester exec close` — finalize recording

## Issue logging

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
