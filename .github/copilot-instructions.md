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
# AI mode (default) — no prompts:
form-tester test <url> --auto
form-tester test <url> --auto --pnr 12345 --persona ung-mann --scenario "test validation"

# Human mode — prompts for persona, scenario, person selection:
form-tester test <url> --human

# Full interactive CLI:
form-tester
```

Persona IDs: `ung-mann`, `gravid-kvinne`, `eldre-kvinne`, `kronisk-syk-mann`. Defaults to "noen" if omitted.

When the user asks for `--human` mode, use that flag. Otherwise default to `--auto`.

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

## Playwright CLI (use via form-tester exec)

IMPORTANT: Always use `form-tester exec` instead of `playwright-cli` directly. This records all commands for replay.

```bash
form-tester exec open https://example.com
form-tester exec snapshot
form-tester exec fill e1 "value"
form-tester exec click e3
form-tester exec screenshot --filename=page.png --full-page
form-tester exec close           # finalizes recording
```

Replay a previous run:
```bash
form-tester replay output/form-id/timestamp/recording.json
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

Document capture — FIRST detect the format by running `form-tester exec snapshot`:

**PDF documents** (iframe/embed with .pdf or blob: URL, or screenshot times out): Do NOT screenshot PDFs. Download instead:
1. Extract URL: `form-tester exec eval "document.querySelector('iframe')?.src || document.querySelector('embed')?.src || document.querySelector('object')?.data"`
2. Download: `form-tester exec run-code "async page => { const url = await page.evaluate(() => document.querySelector('iframe')?.src || document.querySelector('embed')?.src || document.querySelector('object')?.data); if (url) { const resp = await page.request.get(url); require('fs').writeFileSync('OUTPUT_DIR/document.pdf', await resp.body()); } }"`
3. Or click the download button in the PDF viewer if available.
4. If `--full-page` screenshot times out, it's a PDF — switch to download, don't retry screenshot.

**HTML documents**: `form-tester exec screenshot --filename "..." --full-page`. Also save raw HTML.

**XML/other**: note the type in test_results.txt and skip capture.
