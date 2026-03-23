# Form Tester — Copilot Instructions

You have access to a form-testing CLI tool (`form-tester`) that automates testing of /skjemautfyller forms using Playwright CLI.

## Setup

User must install globally first:
```bash
npm install -g form-tester
form-tester install
```

## Running a test

When the user gives you a form URL to test, execute ALL steps below in sequence WITHOUT stopping to ask. Do not ask "want me to continue?" — just do the entire flow.

### Step 1 — Start the test

If the user gives a partial URL (e.g. `skjemautfyller/SLV-PasRapp-2020`), read `form-tester.config.json` first to get `baseUrl` and `pnr`. Construct the full URL as `{baseUrl}/{partial-path}?pnr={pnr}`. Do NOT guess the domain — always use `baseUrl` from config.

```bash
form-tester test <full-url> --auto
```
Or with options:
```bash
form-tester test <full-url> --auto --pnr 12345 --persona ung-mann --scenario "test validation"
```

### Step 2 — Dismiss cookies
```bash
form-tester cookies
```

### Step 3 — Select person
```bash
form-tester select-person
```
To select a specific person: `form-tester select-person "Name"`

### Step 4 — Study the form
Take a snapshot and identify ALL sections and required fields:
```bash
form-tester exec snapshot
```
Look for collapsed/accordion sections (buttons with arrow icons). Expand ALL of them by clicking their header buttons before filling anything.

### Step 5 — Fill the form
Use `form-tester exec` for ALL commands (this records them for replay):
```bash
form-tester exec fill <ref> "value"
form-tester exec click <ref>
form-tester exec select <ref> "option text"
form-tester exec screenshot --filename "path.png" --full-page
```

For autosuggest/search fields: fill the text, wait for dropdown, then click the suggestion:
```bash
form-tester exec fill <ref> "search text"
form-tester exec snapshot          # find the suggestion element
form-tester exec click <suggestion-ref>
```

### Step 6 — Submit
Take a screenshot, then click the submit button.

### Step 7 — Handle validation errors
IMPORTANT: If validation errors appear after submit, the form DID NOT SUBMIT. Run:
```bash
form-tester validate
```
This parses all validation errors, clicks each error link to scroll to the field, and shows what needs to be filled. Fix each field, then run `form-tester validate` again to confirm. Only then resubmit.

RULES:
- Maximum 3 submit attempts. After 3, STOP and write results.
- Do NOT re-fill fields that are already filled.
- Do NOT use JavaScript `dispatchEvent` or `element.evaluate()` to set values.
- Always use Playwright's `fill`, `click`, `select` commands.

### Step 8 — Post-submit verification
After successful submission, read the modal text:
- If it mentions Dokumenter storage ("lagret i Dokumenter") → run document verification
- If it does NOT mention Dokumenter → skip, note in test_results.txt

### Step 9 — Document verification
```bash
form-tester documents
```
This handles everything: navigate to Dokumenter, find latest doc, detect PDF vs HTML, download or screenshot.

### Step 10 — Finalize
- Write test_results.txt with status, data used, and notes
- Close browser: `form-tester exec close`

## Issue logging

When something unexpected happens, log it:
```bash
form-tester issue <category> "<description>"
```
Categories: `person-selection`, `navigation`, `form-fill`, `submission`, `documents`, `pdf-download`, `html-capture`, `screenshot`, `snapshot`, `validation`, `modal`, `timeout`, `other`

View recent issues: `form-tester issues`

## Important rules

- ALWAYS use `form-tester exec` instead of `playwright-cli` directly
- ALL screenshots MUST use `--full-page`
- Take a screenshot EVERY TIME the page changes
- Do NOT stop to ask the user between steps — execute the full flow
- Persona IDs: `ung-mann`, `gravid-kvinne`, `eldre-kvinne`, `kronisk-syk-mann`, `noen`

## Human mode

When user asks for `--human` mode:
1. Run `form-tester test <url> --human` to get persona list
2. Ask user to pick persona and scenario
3. Re-run: `form-tester test <url> --human --persona <id> --scenario "<text>"`
