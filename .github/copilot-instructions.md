# Form Tester — Copilot Instructions

You have access to a form-testing CLI tool (`form-tester`) that automates testing of /skjemautfyller forms using Playwright CLI.

## Setup

User must install globally first:
```bash
npm install -g form-tester
form-tester install
```

## Running the CLI

```bash
# Interactive
form-tester

# Non-interactive (best for AI agents)
form-tester test <url> --auto
form-tester test <url> --auto --pnr 12345 --persona ung-mann --scenario "test validation"
```

Persona IDs: `ung-mann`, `gravid-kvinne`, `eldre-kvinne`, `kronisk-syk-mann`. Defaults to "noen" if omitted.

## Commands

| Command | Description |
|---------|-------------|
| `/setup` | Initial setup |
| `/update` | Update Playwright CLI + skills |
| `/version` | Show version |
| `/people` | Rescan visible person list |
| `/test {url}` | Test a form URL |
| `/save {label}` | Save snapshot + screenshot |
| `/clear` | Clear session |
| `/quit` | Exit CLI |

## Playwright CLI

You can also use `playwright-cli` commands directly for browser automation:

```bash
playwright-cli open https://example.com
playwright-cli snapshot
playwright-cli fill e1 "value"
playwright-cli click e3
playwright-cli screenshot --filename=page.png --full-page
playwright-cli close
```

## Test Flow

When `/test` is triggered:

1. Prompt for PNR if not in URL. Wait for response.
2. Prompt for persona (numbered selection). Wait for response.
3. Prompt for test scenario in a separate message. Wait for response.
4. Only after all prompts answered: open browser, fill form, submit, verify.

## Important Notes

- Provide a full /skjemautfyller URL. If `pnr` is missing, the CLI will prompt.
- All screenshots MUST use `--full-page` to capture the entire page.
- Take a full-page screenshot EVERY TIME the page changes: after clicking action buttons (Neste, Forrige, Send inn), after step/page transitions, after validation errors, after modals, and after submission.
- Use `/save {label}` to capture additional snapshots into the output folder.
- If an error modal appears on submit, open DevTools -> Network, retry once, and capture the Correlation ID header.

## Post-Submit Verification

After submission, read the modal text:
- If it mentions Dokumenter storage -> navigate to `/dokumenter?pnr={PNR}`, verify the document appears.
- If it does NOT mention Dokumenter -> skip verification, note in test_results.txt.

Document capture depends on format:
- **PDF documents**: download the file (`playwright-cli pdf --filename "..." `). Do NOT screenshot PDFs.
- **HTML documents**: take a full-page screenshot of the ENTIRE document (`playwright-cli screenshot --filename "..." --full-page`). HTML documents cannot be downloaded, so the screenshot is the primary artifact.
- **XML/other**: note the type in test_results.txt and skip capture.
