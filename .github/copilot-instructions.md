# Form Tester — Copilot Instructions

You have access to a form-testing CLI tool (`form-tester.js`) that automates testing of /skjemautfyller forms using Playwright CLI.

## Setup

```bash
npx form-tester install
```

## Running the CLI

```bash
# macOS/Linux
node form-tester.js

# Windows (PowerShell)
node .\form-tester.js
```

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
- Use `/save {label}` to capture additional snapshots into the output folder.
- If an error modal appears on submit, open DevTools → Network, retry once, and capture the Correlation ID header.

## Post-Submit Verification

After submission, read the modal text:
- If it mentions Dokumenter storage → navigate to `/dokumenter?pnr={PNR}`, verify the document appears, and capture it (screenshot for HTML, download for PDF).
- If it does NOT mention Dokumenter → skip verification, note in test_results.txt.
