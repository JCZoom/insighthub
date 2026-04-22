# AI Spend Tracker — Setup Guide

Tracks all AI token spending across two sources in a shared Google Sheet:
- **Tab 1: Windsurf Credits** — Parsed automatically from email receipts via Google Apps Script
- **Tab 2: Cloud API Usage** — Pushed automatically after each overnight builder run
- **Tab 3: Summary** — Auto-calculated totals, charts, and trends

## Prerequisites

- A Google account (for Sheets + Apps Script)
- A Google Cloud project (for Sheets API service account — free tier)
- Gmail receiving Windsurf purchase receipts

---

## Step 1: Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) → **Blank spreadsheet**
2. Name it: **"AI Token Spend Tracker"**
3. Create three tabs (sheets) at the bottom:

### Tab: `Windsurf Credits`

| Column | Header (Row 1) | Format | Notes |
|--------|----------------|--------|-------|
| A | Date | Date | Purchase date |
| B | Amount (USD) | Currency | Dollar amount charged |
| C | Email Subject | Text | For audit trail |
| D | Email Date | Date-time | When the email arrived |
| E | Parsed By | Text | "Apps Script" (auto) or "Manual" |
| F | Notes | Text | Optional notes |

### Tab: `Cloud API Usage`

| Column | Header (Row 1) | Format | Notes |
|--------|----------------|--------|-------|
| A | Date | Date | Run date |
| B | Project | Text | e.g. "InsightHub" |
| C | Run Type | Text | "overnight-builder" or "sprint-review" |
| D | Model | Text | e.g. "claude-sonnet-4-20250514" |
| E | Tasks Attempted | Number | |
| F | Tasks Succeeded | Number | |
| G | Total Cost (USD) | Currency | |
| H | Input Tokens | Number | |
| I | Output Tokens | Number | |
| J | Duration (min) | Number | |
| K | Budget Cap (USD) | Currency | |
| L | Log File | Text | Path/name for reference |

### Tab: `Summary`

Paste these formulas (adjust ranges as your data grows):

```
A1: "AI Spend Summary"
A3: "Period"          B3: "Windsurf Credits"    C3: "Cloud API"    D3: "Total"

# Current month totals
A4: =TEXT(TODAY(),"MMMM YYYY")
B4: =SUMPRODUCT(('Windsurf Credits'!A:A>=DATE(YEAR(TODAY()),MONTH(TODAY()),1))*('Windsurf Credits'!B:B))
C4: =SUMPRODUCT(('Cloud API Usage'!A:A>=DATE(YEAR(TODAY()),MONTH(TODAY()),1))*('Cloud API Usage'!G:G))
D4: =B4+C4

# Last month totals
A5: =TEXT(EDATE(TODAY(),-1),"MMMM YYYY")
B5: =SUMPRODUCT(('Windsurf Credits'!A:A>=DATE(YEAR(EDATE(TODAY(),-1)),MONTH(EDATE(TODAY(),-1)),1))*('Windsurf Credits'!A:A<DATE(YEAR(TODAY()),MONTH(TODAY()),1))*('Windsurf Credits'!B:B))
C5: =SUMPRODUCT(('Cloud API Usage'!A:A>=DATE(YEAR(EDATE(TODAY(),-1)),MONTH(EDATE(TODAY(),-1)),1))*('Cloud API Usage'!A:A<DATE(YEAR(TODAY()),MONTH(TODAY()),1))*('Cloud API Usage'!G:G))
D5: =B5+C5

# All-time totals
A7: "All Time"
B7: =SUM('Windsurf Credits'!B:B)
C7: =SUM('Cloud API Usage'!G:G)
D7: =B7+C7

# Cloud API breakdown by model (row 9+)
A9: "Cloud API by Model"
A10: =UNIQUE('Cloud API Usage'!D2:D)
B10: =SUMIF('Cloud API Usage'!D:D,A10,'Cloud API Usage'!G:G)
```

4. **Share the sheet** with your team (View or Edit access as needed).

---

## Step 2: Set Up Google Cloud Service Account (for Cloud API tab)

This lets the overnight builder push data to the sheet via API.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one), e.g. "AI Spend Tracker"
3. Enable the **Google Sheets API**:
   - APIs & Services → Library → search "Google Sheets API" → Enable
4. Create a **Service Account**:
   - APIs & Services → Credentials → Create Credentials → Service Account
   - Name: `spend-tracker-bot`
   - Role: none needed (it only accesses sheets shared with it)
   - Click "Done"
5. Create a key:
   - Click the service account → Keys → Add Key → JSON
   - Download the JSON file
   - Save it as: `~/.config/ai-spend-tracker-sa.json`
   - **⚠️ Do NOT commit this file to git**
6. **Share your Google Sheet** with the service account email:
   - The email looks like: `spend-tracker-bot@your-project.iam.gserviceaccount.com`
   - Share with **Editor** access

7. Note your **Spreadsheet ID** (from the URL):
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
   ```

8. Add to your project `.env`:
   ```bash
   # AI Spend Tracker
   SPEND_TRACKER_SHEET_ID=your_spreadsheet_id_here
   SPEND_TRACKER_SA_KEY=~/.config/ai-spend-tracker-sa.json
   ```

---

## Step 3: Set Up Gmail → Google Apps Script (for Windsurf Credits tab)

This runs inside the Google Sheet itself — no external services needed.

1. Open your "AI Token Spend Tracker" Google Sheet
2. Go to **Extensions → Apps Script**
3. Delete any default code and paste the contents of `scripts/windsurf-receipt-parser.gs`
   (see file in this repo, or below)
4. **Configure the script:**
   - Update `SENDER_FILTER` if Windsurf uses a different sender email
   - Update `SUBJECT_FILTER` if the subject line differs
   - Run `parseWindsurfReceipts` once manually (it will ask for Gmail permissions — authorize it)
5. **Set up a time trigger:**
   - In Apps Script: Triggers (⏰ icon on the left) → Add Trigger
   - Function: `parseWindsurfReceipts`
   - Event source: Time-driven
   - Type: Hour timer → Every hour (or Day timer → 8am–9am)
   - Click Save

The script will:
- Search Gmail for new Windsurf receipt emails since the last run
- Parse the dollar amount from the email body
- Append a row to the "Windsurf Credits" tab
- Label processed emails so they aren't re-processed

---

## Step 4: Install Python Dependencies (for overnight builder push)

```bash
pip install google-auth google-auth-oauthlib google-api-python-client
```

Or add to your builder's requirements:
```
google-auth>=2.0
google-api-python-client>=2.0
```

---

## Step 5: Test Everything

### Test Cloud API push:
```bash
python3 ~/Projects/long_builder/push_to_sheets.py \
  --project-dir /Users/Jeffrey.Coy/CascadeProjects/InsightHub \
  --test
```

### Test Apps Script:
1. In the Apps Script editor, click ▶️ Run on `parseWindsurfReceipts`
2. Check the "Windsurf Credits" tab for new rows

### Verify Summary tab:
- Formulas should auto-calculate once data exists in both tabs

---

## Architecture Diagram

```
┌──────────────────────┐     Gmail API (built-in)      ┌─────────────────────┐
│  Windsurf Receipts   │ ──────────────────────────────▶│                     │
│  (email to Gmail)    │     Google Apps Script          │   Google Sheet      │
└──────────────────────┘     (hourly trigger)            │                     │
                                                         │  Tab 1: Windsurf    │
┌──────────────────────┐     Google Sheets API           │  Tab 2: Cloud API   │
│  Overnight Builder   │ ──────────────────────────────▶│  Tab 3: Summary     │
│  (run-builder.sh)    │     push_to_sheets.py           │                     │
└──────────────────────┘     (post-run hook)             │  ← Shared with team │
                                                         └─────────────────────┘
```

---

## Maintenance

- **Apps Script logs:** Extensions → Apps Script → Executions (left sidebar)
- **Cloud API push logs:** Check builder log output for `📊 Sheets:` lines
- **If receipts stop parsing:** Windsurf may have changed their email format. Update the regex in the Apps Script.
- **Backfill:** Both scripts support manual entry. Just add rows directly to the sheet.

---

## Cost

| Component | Cost |
|-----------|------|
| Google Sheet | Free |
| Google Apps Script | Free (runs on Google's infra) |
| Google Cloud Service Account | Free |
| Google Sheets API | Free (under 500 req/day) |
| **Total** | **$0/month** |
