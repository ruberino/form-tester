# Form Tester Skill Instructions

Install (user runs once):
```
npm install -g form-tester
```

Install skill files:
```
form-tester install
```

Test modes:
```
# AI mode (default) — no prompts:
form-tester test <url> --auto
form-tester test <url> --auto --pnr 12345 --persona ung-mann

# Human mode — user chooses persona and scenario:
# Step 1: Run without flags to see available personas:
form-tester test <url> --human
# Step 2: Ask the user which persona and scenario they want.
# Step 3: Re-run with their choices:
form-tester test <url> --human --persona ung-mann --scenario "test validation"

# Full interactive CLI:
form-tester
```

When the user asks for human/interactive mode, use `--human`:
1. First run `form-tester test <url> --human` (no flags) to get the persona list.
2. Show the personas to the user and ask them to choose.
3. Ask the user for a test scenario (or use "" for standard).
4. Re-run with their choices: `form-tester test <url> --human --persona <id> --scenario "<text>"`
Otherwise default to `--auto`.

Commands:
```
/setup
/update
/version
/people
/test {url}
/save {label}
/clear
/quit
```

Notes:
- New users: run `npm install -g form-tester` then `form-tester install` in your project.
- Provide a full /skjemautfyller URL. If `pnr` is missing, the CLI will prompt.
- The CLI opens the form with Playwright CLI, saves an initial snapshot + screenshot, and prints next-step commands.
- Use `/save {label}` to capture additional snapshots + screenshots into the same output folder.
- Use `/update` after changing the skill to update Playwright CLI + skills, then reload the skill in Copilot CLI with `/skills` (reload) or `/restart`.
- Use `/people` to rescan the visible person list and get a numbered selection prompt.
- Use the next-step checklist printed by the CLI (cookies, person selection, validation fix, Dokumenter verification, save HTML/PDF).
- If the error modal appears on save or submit ("Det skjedde en feil under innsending av skjema. Prøv igjen senere."), open DevTools -> Network before retrying. Then try resubmitting once. If it persists, find the failed request and capture the Correlation ID header in test_results.txt.
- Use `--help` or `-h` to print the command list without starting the prompt.
- IMPORTANT: Always use `form-tester exec` instead of `playwright-cli` directly. This records all commands for replay. Same syntax: `form-tester exec fill e1 "value"`, `form-tester exec click e3`, `form-tester exec close` (finalizes recording).
- Replay a previous run: `form-tester replay output/form-id/timestamp/recording.json`
- IMPORTANT: All screenshots taken during a test run MUST use `--full-page` to capture the entire page, not just the viewport. This applies to every screenshot command: `form-tester exec screenshot --filename "..." --full-page`
- IMPORTANT: Take a full-page screenshot EVERY TIME the page changes. This includes: after clicking any action button (Neste, Forrige, Send inn, etc.), after a step/page transition, after form validation errors appear, after modals open, and after submission. Name screenshots descriptively (e.g., step1_filled.png, step2_before_submit.png, submit_result.png).

Test flow (when /test is triggered):
IMPORTANT: Each prompt below MUST be asked as a separate message to the user. Wait for the user's response before proceeding to the next step. Do NOT combine multiple prompts into one message.

1. Prompt for PNR (if not in URL). Wait for response.
2. Prompt for persona (1-6 selection). Show the numbered list and wait for the user's response.
3. Prompt for test scenario in a NEW separate message. Ask: "Any specific test scenario? (describe what to test, or Enter for standard clean test)". Wait for the user's response. If the user says nothing specific or "default" or just presses Enter, use standard test. The scenario is saved to scenario.json in the output directory.
4. Only after receiving answers to all prompts: open browser, fill form, submit, verify.

Post-submit verification:
After a successful submission, read the modal text carefully:
- If it says the form is stored in Dokumenter (e.g. "En kopi er også lagret i Dokumenter" or "Skjemaet er fullført og lagret i Dokumenter"), proceed with Dokumenter verification below.
- If the modal does NOT mention Dokumenter, or says the form will not be stored/you will not get a response, skip Dokumenter verification entirely. Record this in test_results.txt.

Dokumenter verification (only when modal confirms storage):
1. Navigate to `/dokumenter?pnr={PNR}` and select the same person used during form fill.
2. The document list loads sorted newest first. The first entry should match the form title.
3. Click "Se detaljer" on the first document, then click "Åpne dokumentet".
4. After clicking "Åpne dokumentet", determine the document format:

   How to detect format:
   - Take a snapshot: `form-tester exec snapshot`
   - If snapshot shows a link with href containing `/pdf/` or `blob:` → PDF
   - If `--full-page` screenshot times out → PDF (do NOT retry, switch to download)
   - If snapshot shows rendered HTML content (headings, paragraphs, form data) → HTML

   PDF documents — DOWNLOAD, do NOT screenshot:
   IMPORTANT: `run-code` does NOT have access to `require` or `fs`. Do NOT use `require('fs')`. Use Playwright's download API instead.

   Find the PDF download link in the snapshot (look for `a[href*="/pdf/"]` or "Last ned" link), then download using the Playwright download event:
   ```
   form-tester exec run-code "async page => { const link = page.locator('a[href*=\"/pdf/\"]').first(); const [download] = await Promise.all([ page.waitForEvent('download'), link.click() ]); await download.saveAs('$OUTPUT_DIR/document.pdf'); }"
   ```
   If there is no direct PDF link but a "Last ned" button:
   ```
   form-tester exec run-code "async page => { const [download] = await Promise.all([ page.waitForEvent('download'), page.getByRole('link', { name: 'Last ned' }).click() ]); await download.saveAs('$OUTPUT_DIR/document.pdf'); }"
   ```
   Verify the download: check that document.pdf exists in the output folder.

   HTML documents — SCREENSHOT full page:
   ```
   form-tester exec screenshot --filename "$OUTPUT_DIR/document_screenshot.png" --full-page
   ```
   Also save raw HTML: `form-tester exec eval "document.documentElement.outerHTML"` → save to document.html.

   XML/other: Note type in test_results.txt, skip capture.

5. Include the document verification results in test_results.txt (document title, whether it matched the form h1, document type: HTML/PDF/XML).
