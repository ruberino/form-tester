# Form Tester Skill Instructions

Setup (run once):
```
npx form-tester install
```

Run the CLI:
```
npx form-tester
```

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
- New users: place this skill under .claude/skills/form-tester/ in your repo, then run /skills to scan/reload (or /restart).
- Provide a full /skjemautfyller URL. If `pnr` is missing, the CLI will prompt.
- The CLI opens the form with Playwright CLI, saves an initial snapshot + screenshot, and prints next-step commands.
- Use `/save {label}` to capture additional snapshots + screenshots into the same output folder.
- Use `/update` after changing the skill to update Playwright CLI + skills, then reload the skill in Copilot CLI with `/skills` (reload) or `/restart`.
- Use `/people` to rescan the visible person list and get a numbered selection prompt.
- Use the next-step checklist printed by the CLI (cookies, person selection, validation fix, Dokumenter verification, save HTML/PDF).
- If the error modal appears on save or submit ("Det skjedde en feil under innsending av skjema. Prøv igjen senere."), open DevTools -> Network before retrying. Then try resubmitting once. If it persists, find the failed request and capture the Correlation ID header in test_results.txt.
- Use `--help` or `-h` to print the command list without starting the prompt.
- Playwright CLI commands are available from this skill when needed.
- IMPORTANT: All screenshots taken during a test run MUST use `--full-page` to capture the entire page, not just the viewport. This applies to every screenshot command: `playwright-cli screenshot --filename "..." --full-page`

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
4. If the document opens in a new tab as HTML: switch to that tab, take a full-page screenshot (`--full-page`), save snapshot and raw HTML.
5. If the document opens as a PDF viewer: download the PDF instead of screenshotting. Use `playwright-cli pdf --filename "$OUTPUT_DIR/document.pdf"` or save it via the download.
6. If the document does NOT open (XML format, no new tab, or other): note the document type in test_results.txt and skip the screenshot/download.
7. Include the document verification results in test_results.txt (document title, whether it matched the form h1, document type: HTML/PDF/XML).

