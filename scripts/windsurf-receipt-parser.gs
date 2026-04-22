/**
 * Windsurf Receipt Parser — Google Apps Script
 * 
 * Automatically parses Windsurf purchase receipt emails from Gmail
 * and appends rows to the "Windsurf Credits" tab of this spreadsheet.
 * 
 * Setup:
 *   1. Open your AI Spend Tracker Google Sheet
 *   2. Extensions → Apps Script
 *   3. Paste this code
 *   4. Run parseWindsurfReceipts() once manually to authorize Gmail access
 *   5. Set a time trigger (hourly or daily)
 * 
 * See docs/AI_SPEND_TRACKER_SETUP.md for full instructions.
 */

// ── Configuration ────────────────────────────────────────────────────────────

// Gmail search filters — adjust these if Windsurf changes their email format
const SENDER_FILTER = 'from:noreply@windsurf.com OR from:receipts@windsurf.com OR from:billing@codeium.com OR from:noreply@codeium.com';
const SUBJECT_FILTER = 'subject:(receipt OR invoice OR payment OR charge)';

// Label applied to processed emails so we don't re-process them
const PROCESSED_LABEL_NAME = 'SpendTracker/Processed';

// Sheet tab name — must match exactly
const SHEET_TAB_NAME = 'Windsurf Credits';

// ── Main Function ────────────────────────────────────────────────────────────

/**
 * Search Gmail for unprocessed Windsurf receipts, parse amounts, and append
 * rows to the spreadsheet. Safe to run repeatedly — processed emails are
 * labeled and skipped on subsequent runs.
 */
function parseWindsurfReceipts() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TAB_NAME);
  if (!sheet) {
    throw new Error(`Tab "${SHEET_TAB_NAME}" not found. Create it first (see setup guide).`);
  }

  // Ensure header row exists
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Date', 'Amount (USD)', 'Email Subject', 'Email Date', 'Parsed By', 'Notes']);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
  }

  // Get or create the processed label
  let label = GmailApp.getUserLabelByName(PROCESSED_LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(PROCESSED_LABEL_NAME);
  }

  // Search for Windsurf emails NOT already labeled as processed
  const query = `${SENDER_FILTER} ${SUBJECT_FILTER} -label:${PROCESSED_LABEL_NAME.replace('/', '-')}`;
  const threads = GmailApp.search(query, 0, 50);

  if (threads.length === 0) {
    Logger.log('No new Windsurf receipt emails found.');
    return;
  }

  Logger.log(`Found ${threads.length} unprocessed receipt thread(s).`);

  let rowsAdded = 0;

  for (const thread of threads) {
    const messages = thread.getMessages();

    for (const message of messages) {
      const subject = message.getSubject();
      const body = message.getPlainBody();
      const htmlBody = message.getBody();
      const emailDate = message.getDate();

      // Try to parse the dollar amount from the email
      const amount = parseAmount(body, htmlBody);

      if (amount !== null) {
        sheet.appendRow([
          Utilities.formatDate(emailDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
          amount,
          subject,
          Utilities.formatDate(emailDate, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
          'Apps Script',
          ''
        ]);
        rowsAdded++;
        Logger.log(`Parsed: $${amount} from "${subject}" (${emailDate})`);
      } else {
        // Still log it but flag for manual review
        sheet.appendRow([
          Utilities.formatDate(emailDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
          '',
          subject,
          Utilities.formatDate(emailDate, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
          'Apps Script',
          '⚠️ AMOUNT NOT PARSED — manual review needed'
        ]);
        rowsAdded++;
        Logger.log(`WARNING: Could not parse amount from "${subject}". Added row for manual review.`);
      }
    }

    // Label the thread as processed
    thread.addLabel(label);
  }

  Logger.log(`Done. Added ${rowsAdded} row(s) to "${SHEET_TAB_NAME}".`);
}

// ── Amount Parsing ───────────────────────────────────────────────────────────

/**
 * Extract a dollar amount from the email body using multiple regex patterns.
 * Returns the amount as a float, or null if not found.
 */
function parseAmount(plainBody, htmlBody) {
  // Try multiple patterns, most specific first
  const patterns = [
    // "$XX.XX" near keywords like "total", "charged", "amount", "payment"
    /(?:total|charged|amount|payment|charge)[:\s]*\$?([\d,]+\.?\d{0,2})/i,
    // "USD XX.XX" or "XX.XX USD"
    /USD\s*\$?([\d,]+\.?\d{0,2})/i,
    /([\d,]+\.?\d{0,2})\s*USD/i,
    // Standalone "$XX.XX" (common in receipts)
    /\$\s*([\d,]+\.\d{2})/,
    // "Amount: XX.XX" or "Price: XX.XX"
    /(?:amount|price|cost|fee)[:\s]*\$?([\d,]+\.?\d{0,2})/i,
  ];

  // Try plain text body first, then HTML body
  const bodies = [plainBody || '', htmlBody || ''];

  for (const body of bodies) {
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match && match[1]) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        // Sanity check — Windsurf credits are typically $1–$500
        if (amount > 0 && amount < 10000) {
          return amount;
        }
      }
    }
  }

  return null;
}

// ── Manual Backfill Helper ───────────────────────────────────────────────────

/**
 * Manually add a Windsurf credit purchase. Run from the Apps Script editor.
 * Useful for backfilling historical purchases.
 * 
 * Usage: Update the values below and run this function.
 */
function addManualEntry() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TAB_NAME);

  // ── Update these values ──
  const date = '2026-04-15';       // YYYY-MM-DD
  const amount = 50.00;            // USD
  const notes = 'Backfill — April credits purchase';
  // ──────────────────────────

  sheet.appendRow([date, amount, 'Manual entry', '', 'Manual', notes]);
  Logger.log(`Added manual entry: $${amount} on ${date}`);
}

// ── Utility ──────────────────────────────────────────────────────────────────

/**
 * Reset the processed label (for testing). Removes the label from all threads
 * so they'll be re-processed on the next run.
 * 
 * ⚠️ Only use this for testing — will cause duplicate rows if not careful.
 */
function resetProcessedLabel() {
  const label = GmailApp.getUserLabelByName(PROCESSED_LABEL_NAME);
  if (!label) {
    Logger.log('No processed label found — nothing to reset.');
    return;
  }

  const threads = label.getThreads();
  for (const thread of threads) {
    thread.removeLabel(label);
  }
  Logger.log(`Removed label from ${threads.length} thread(s).`);
}
