# CleanSheet

CleanSheet is a browser-first CSV data-cleaning workspace. Upload a file, edit it like a spreadsheet, define validation rules, fix issues, and export the cleaned result without sending data to a backend.

## Highlights

- Fast client-side CSV loading and AG Grid editing, including large datasets.
- Column types and friendly validation rules for text, numbers, dates, email, phone, booleans, and categories.
- Custom regex rules, reusable templates, live testing, and category allowed-value lists.
- Validation issue navigation, bulk fill/delete actions, weighted category distribution fills, and formula-based column relationships.
- Find and replace across visible columns, undo/redo for data edits, and CSV export.

## Run Locally

```powershell
cd frontend
npm ci
npm run dev
```

Open the local URL shown by Vite. Use `Load Sample Dataset` to try the included transaction CSV.

## Deploy To GitHub Pages

The repository includes a GitHub Actions workflow that builds and deploys `frontend/` when changes are pushed to `main`.

1. Push this repository to GitHub.
2. In the repository, open **Settings -> Pages** and select **GitHub Actions** as the deployment source.
3. Wait for the `Deploy Frontend to GitHub Pages` workflow to finish.

The published app is available at `https://<github-user>.github.io/<repository>/`.

## Tech

React, Vite, AG Grid, and Papa Parse. All data processing runs locally in the browser.
