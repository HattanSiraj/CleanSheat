# CleanSheet

Your CSV is not broken. It is merely experiencing a difficult time.

CleanSheet is a browser-based data-cleaning app for opening a CSV, clicking around, finding suspicious values, and making the spreadsheet behave itself. No account. No backend. No uploading your data to a mysterious server called `definitely-not-data-harvesting-9000`.

## What It Does

- Opens CSV files, including fairly large ones, without immediately melting down.
- Lets you edit cells directly in a spreadsheet-style table.
- Checks columns for dates, numbers, emails, phones, categories, and other suspicious-looking things.
- Supports friendly validation rules, allowed category values, and raw regex for people who enjoy brackets.
- Finds missing or invalid values and helps you fill, replace, delete, or fix them.
- Fills category problems by the distribution of valid existing values. Statistics, but approachable.
- Supports column relationships such as `Total = Quantity * Price`.
- Has undo and redo because confidence is temporary.
- Exports the cleaned CSV when you are done fighting it.

## Try It

The hosted version lives here:

**[Open CleanSheet](https://hattansiraj.github.io/CleanSheat/)**

Or run it locally:

```powershell
cd frontend
npm ci
npm run dev
```

Then open the local URL Vite gives you and press **Load Sample Dataset**. It contains transactions, coffee, cakes, and enough bad data to keep things interesting.

## Built With

- React + Vite
- AG Grid, for the spreadsheet part
- Papa Parse, for convincing CSV files to become data
- A concerning amount of local browser state

## Tiny Disclaimer

CleanSheet runs in your browser, so your CSV stays on your machine unless you export it or personally decide to do something dramatic with it.

If the app makes your dataset look clean, please take full credit.
