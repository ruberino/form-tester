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

# Human mode — prompts for persona, scenario, person selection:
form-tester test <url> --human

# Full interactive CLI:
form-tester
```

When the user asks for human/interactive mode, use `--human`. Otherwise default to `--auto`.

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
4. IMPORTANT - document capture depends on format:

   PDF documents (shown in a PDF viewer/modal/iframe):
   Do NOT screenshot PDFs. Instead, download the actual PDF file:
   a. Take a snapshot to find the PDF viewer element: `form-tester exec snapshot`
   b. Find the iframe or embed/object element that displays the PDF. Look for src attributes containing .pdf or blob: URLs.
   c. Extract the PDF URL: `form-tester exec eval "document.querySelector('iframe')?.src || document.querySelector('embed')?.src || document.querySelector('object')?.data"`
   d. If the URL is a blob: URL or direct PDF link, download it: `form-tester exec eval "async () => { const r = await fetch(document.querySelector('iframe')?.src); const b = await r.blob(); return URL.createObjectURL(b); }"`
   e. Or use the download button if the PDF viewer has one — look for a download icon/button in the snapshot and click it.
   f. Save the PDF: `form-tester exec pdf --filename "$OUTPUT_DIR/document.pdf"`
   g. If all else fails, right-click save or use: `form-tester exec run-code "async page => { const frame = page.frameLocator('iframe').first(); /* extract content */ }"`

   HTML documents (opens in a new tab or renders in page):
   Take a FULL-PAGE screenshot of the ENTIRE document (`form-tester exec screenshot --filename "$OUTPUT_DIR/document_screenshot.png" --full-page`). HTML documents cannot be downloaded as files, so the full-page screenshot is the primary artifact. Also save the snapshot and raw HTML with:
   `form-tester exec eval "document.documentElement.outerHTML"` and save to document.html.

   XML/other formats: Note the document type in test_results.txt and skip capture.

5. Include the document verification results in test_results.txt (document title, whether it matched the form h1, document type: HTML/PDF/XML).
