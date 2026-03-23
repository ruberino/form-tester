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
- IMPORTANT: When something unexpected happens during a test — wrong page state, unexpected modal, failed command, element not found, timeout, wrong document format — ALWAYS log an issue:
  `form-tester issue <category> "<description of what happened>"`
  Categories: person-selection, navigation, form-fill, submission, documents, pdf-download, html-capture, screenshot, snapshot, validation, modal, timeout, other
  Example: `form-tester issue modal "Submit showed error modal instead of success: Det skjedde en feil"`
  Example: `form-tester issue person-selection "Person list showed 0 options, had to retry manually"`
  These logs help us improve the skill to handle more scenarios automatically.
- View logged issues: `form-tester issues`
- IMPORTANT: All screenshots taken during a test run MUST use `--full-page` to capture the entire page, not just the viewport. This applies to every screenshot command: `form-tester exec screenshot --filename "..." --full-page`
- IMPORTANT: Take a full-page screenshot EVERY TIME the page changes. This includes: after clicking any action button (Neste, Forrige, Send inn, etc.), after a step/page transition, after form validation errors appear, after modals open, and after submission. Name screenshots descriptively (e.g., step1_filled.png, step2_before_submit.png, submit_result.png).

Test flow (when /test is triggered):
IMPORTANT: Each prompt below MUST be asked as a separate message to the user. Wait for the user's response before proceeding to the next step. Do NOT combine multiple prompts into one message.

1. Prompt for PNR (if not in URL). Wait for response.
2. Prompt for persona (1-6 selection). Show the numbered list and wait for the user's response.
3. Prompt for test scenario in a NEW separate message. Ask: "Any specific test scenario? (describe what to test, or Enter for standard clean test)". Wait for the user's response. If the user says nothing specific or "default" or just presses Enter, use standard test. The scenario is saved to scenario.json in the output directory.
4. Only after receiving answers to all prompts: open browser, fill form, submit, verify.

Form filling strategy:
Before filling any fields, take a snapshot and study the FULL form structure:
1. Identify ALL sections, including collapsed/accordion sections (buttons with arrow icons).
2. Expand ALL collapsed sections FIRST by clicking their header buttons. Take a new snapshot after expanding.
3. Identify ALL required fields across all sections before starting to fill.
4. Fill fields section by section, top to bottom.

Autosuggest / search fields (e.g. "Søk opp et legemiddel"):
These fields show a dropdown with suggestions as you type. Do NOT use `fill` + `Enter` — the value won't commit.
Instead:
```
form-tester exec fill <ref> "search text"
```
Then wait for the dropdown to appear and take a snapshot to find the suggestion element:
```
form-tester exec snapshot
```
Then click the correct suggestion from the dropdown list. If no dropdown appears, try:
```
form-tester exec run-code "async page => { const input = page.locator('#fieldId'); await input.fill('search text'); await page.waitForTimeout(1000); const option = page.locator('[role=\"option\"]').first(); await option.click(); }"
```

Handling validation errors after submit:
CRITICAL RULES — follow these exactly:
1. MAXIMUM 3 submit attempts. If validation errors persist after 3 attempts, STOP. Log the remaining errors with `form-tester issue validation "..."` and note them in test_results.txt. Do NOT keep retrying.
2. After each failed submit, take a snapshot and READ the validation error list carefully.
3. Each validation error is a clickable link with an href like `#fieldId`. Click the error link to scroll to and focus the unfilled field. This is the ONLY reliable way to find the field.
4. After clicking the error link, take a snapshot to see the field in context and fill it.
5. Do NOT re-fill fields that are already filled. Only fix the fields listed in the validation errors.
6. Do NOT use JavaScript `dispatchEvent` hacks or `element.evaluate()` to set values — these bypass React's state and the form won't register the value. Always use Playwright's `fill`, `click`, `select` commands.
7. Before resubmitting, verify that the number of validation errors has decreased. If the same errors persist after you tried to fix them, the approach isn't working — try a different strategy (e.g., expand a collapsed section, use a different selector).
8. Some forms have accordion/collapsible sections. Validation errors inside collapsed sections cannot be filled until the section is expanded. Look for buttons near the error's field ID in the snapshot and click to expand.

Post-submit verification:
After a successful submission, read the modal text carefully:
- If it says the form is stored in Dokumenter (e.g. "En kopi er også lagret i Dokumenter" or "Skjemaet er fullført og lagret i Dokumenter"), proceed with Dokumenter verification below.
- If the modal does NOT mention Dokumenter, or says the form will not be stored/you will not get a response, skip Dokumenter verification entirely. Record this in test_results.txt.

Dokumenter verification (only when modal confirms storage):
Use the standardized documents command — it handles navigation, format detection, PDF download, and HTML capture automatically:
```
form-tester documents
```
This will:
1. Navigate to `/dokumenter?pnr={PNR}`
2. Click "Se detaljer" on the first document
3. Click "Åpne dokumentet"
4. Auto-detect PDF vs HTML format
5. Download PDF or capture HTML screenshot + raw HTML
6. Log issues automatically if any step fails

If `form-tester documents` doesn't find the right elements (logged as issues), fall back to manual steps:
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

5. Log any issues encountered: `form-tester issue documents "description of what went wrong"`
6. Include the document verification results in test_results.txt (document title, whether it matched the form h1, document type: HTML/PDF/XML).
