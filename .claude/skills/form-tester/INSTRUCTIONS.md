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
- Use `--help` or `-h` to print the command list without starting the prompt.
- IMPORTANT: Always use `form-tester exec` instead of `playwright-cli` directly. This records all commands for replay. Same syntax: `form-tester exec fill e1 "value"`, `form-tester exec click e3`, `form-tester exec close` (finalizes recording).
- Replay a previous run: `form-tester replay output/form-id/timestamp/recording.json`
- IMPORTANT: When something unexpected happens during a test — wrong page state, unexpected modal, failed command, element not found, timeout, wrong document format — ALWAYS log an issue:
  `form-tester issue <category> "<description of what happened>"`
  Categories: person-selection, navigation, form-fill, submission, documents, pdf-download, html-capture, screenshot, snapshot, validation, modal, timeout, other
- View logged issues: `form-tester issues`
- IMPORTANT: All screenshots MUST use `--full-page`. Take a full-page screenshot EVERY TIME the page changes.

Test flow (step by step):

IMPORTANT: Each prompt below MUST be asked as a separate message to the user. Wait for the user's response before proceeding to the next step. Do NOT combine multiple prompts into one message.

1. Prompt for PNR (if not in URL). Wait for response.
2. Prompt for persona (1-6 selection). Show the numbered list and wait for the user's response.
3. Prompt for test scenario in a NEW separate message. Wait for the user's response.
4. Only after receiving answers to all prompts, proceed with the steps below.

Step 1 — Open and setup:
If the user gives a partial URL (e.g. `skjemautfyller/SLV-PasRapp-2020`), read `form-tester.config.json` to get `baseUrl` and `pnr`. Construct the full URL as `{baseUrl}/{path}?pnr={pnr}`. Do NOT guess the domain.
```
form-tester test <full-url> --auto --pnr <pnr> --persona <id> --scenario "<text>"
```

Step 2 — Dismiss cookies:
```
form-tester cookies
```
This automatically finds and clicks the cookie banner. No-op if no banner is present.

Step 3 — Select person:
```
form-tester select-person
```
This scans for available persons, selects the recommended one ("Uromantisk Direktør"), clicks it, and takes a screenshot. To select a specific person:
```
form-tester select-person "Navn Navnesen"
```

Step 4 — Study the form structure:
Take a snapshot and study the FULL form before filling anything:
1. Identify ALL sections, including collapsed/accordion sections (buttons with arrow icons).
2. Expand ALL collapsed sections FIRST by clicking their header buttons.
3. Take a new snapshot after expanding.
4. Identify ALL required fields across all sections.

Step 5 — Fill the form:
Fill fields section by section, top to bottom. Use `form-tester exec` for all commands.

Autosuggest / search fields (e.g. "Søk opp et legemiddel"):
Do NOT use `fill` + `Enter` — the value won't commit. Instead:
```
form-tester exec fill <ref> "search text"
```
Wait for the dropdown, take a snapshot to find the suggestion, then click it:
```
form-tester exec snapshot
form-tester exec click <suggestion-ref>
```
Or use run-code:
```
form-tester exec run-code "async page => { const input = page.locator('#fieldId'); await input.fill('search text'); await page.waitForTimeout(1000); const option = page.locator('[role=\"option\"]').first(); await option.click(); }"
```

Step 6 — Submit:
Take a screenshot before submitting, then click the submit button.

Step 7 — Handle validation errors:
IMPORTANT: If validation errors appear after clicking submit, the form DID NOT SUBMIT. The errors are blocking submission. You must fix them first.

Run the validate command to find and scroll to each error:
```
form-tester validate
```
This will:
1. Take a snapshot and parse all validation errors
2. Click each error link to scroll to the unfilled field
3. Take a snapshot at each field so you can see what needs to be filled
4. Print structured output with field IDs and error messages

After `form-tester validate`, fix each field it found, then run `form-tester validate` again to confirm errors are resolved. Only then resubmit.

CRITICAL RULES:
- MAXIMUM 3 submit attempts. After 3, STOP. Log remaining errors with `form-tester issue validation "..."` and note them in test_results.txt.
- Do NOT re-fill fields that are already filled. Only fix fields listed in validation errors.
- Do NOT use JavaScript `dispatchEvent` hacks or `element.evaluate()` to set values — these bypass React's state. Always use Playwright's `fill`, `click`, `select` commands.
- If the same errors persist after fixing, the field might be inside a collapsed accordion section. Expand it first.

Step 8 — Post-submit verification:
After a successful submission, read the modal text carefully:
- If it says the form is stored in Dokumenter (e.g. "lagret i Dokumenter"), proceed with Dokumenter verification.
- If the modal does NOT mention Dokumenter, skip Dokumenter verification. Record this in test_results.txt.

Step 9 — Dokumenter verification (only when modal confirms storage):
```
form-tester documents
```
This handles the full flow: navigate to Dokumenter, find latest doc, detect format, download PDF or screenshot HTML.

If `form-tester documents` fails (logged as issues), fall back to manual steps:
1. Navigate to `/dokumenter?pnr={PNR}` and select the same person.
2. Click "Se detaljer" on the first document, then "Åpne dokumentet".
3. Detect format from snapshot:
   - `a[href*="/pdf/"]` or `blob:` → PDF
   - `--full-page` screenshot times out → PDF
   - Rendered HTML content → HTML

   PDF — download:
   ```
   form-tester exec run-code "async page => { const link = page.locator('a[href*=\"/pdf/\"]').first(); const [download] = await Promise.all([ page.waitForEvent('download'), link.click() ]); await download.saveAs('$OUTPUT_DIR/document.pdf'); }"
   ```

   HTML — screenshot + save:
   ```
   form-tester exec screenshot --filename "$OUTPUT_DIR/document_screenshot.png" --full-page
   form-tester exec eval "document.documentElement.outerHTML"
   ```

Step 10 — Finalize:
- Write test_results.txt with status, data used, and notes.
- Close browser: `form-tester exec close`
