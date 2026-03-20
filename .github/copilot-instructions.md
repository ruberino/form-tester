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

# Human mode — user chooses persona and scenario:
form-tester test <url> --human                                          # lists personas
form-tester test <url> --human --persona ung-mann --scenario "test X"   # run with choices

# Full interactive CLI:
form-tester
```

Persona IDs: `ung-mann`, `gravid-kvinne`, `eldre-kvinne`, `kronisk-syk-mann`. Defaults to "noen" if omitted.

When the user asks for `--human` mode:
1. Run `form-tester test <url> --human` to get persona list.
2. Ask the user to pick a persona and scenario.
3. Re-run: `form-tester test <url> --human --persona <id> --scenario "<text>"` (use `""` for standard test).
Otherwise default to `--auto`.

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

Document capture — detect format via `form-tester exec snapshot`:

**PDF documents** (link with href containing `/pdf/`, or screenshot times out):
Do NOT screenshot PDFs. Do NOT use `require('fs')` in run-code (it doesn't exist there).
Download using Playwright's download event:
```
form-tester exec run-code "async page => { const link = page.locator('a[href*=\"/pdf/\"]').first(); const [download] = await Promise.all([ page.waitForEvent('download'), link.click() ]); await download.saveAs('$OUTPUT_DIR/document.pdf'); }"
```
Or if there's a "Last ned" button:
```
form-tester exec run-code "async page => { const [download] = await Promise.all([ page.waitForEvent('download'), page.getByRole('link', { name: 'Last ned' }).click() ]); await download.saveAs('$OUTPUT_DIR/document.pdf'); }"
```

**HTML documents**: `form-tester exec screenshot --filename "..." --full-page`. Also save raw HTML.

**XML/other**: note the type in test_results.txt and skip capture.
