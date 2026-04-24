# InsightHub — Cross-Region Backup Isolation Setup

> **Closes gap:** G-13 (from `docs/COMPLIANCE_GAPS.md`).
> **Related risk:** R-003 (production backups reside on same host as primary DB).
> **Policies mapped:** USZoom 4133 Backup (BK-03/04), 4428 BCP (BCP-06), 3701 Encryption (ENC-05).
> **Annex A controls:** A.5.29, A.8.13, A.8.14.
> **One-time setup effort:** ~30 minutes by operator with AWS admin credentials.

---

## 1. What this solves

Before this change, InsightHub backups lived only on the **same EC2 instance** as the primary production database. A single host compromise (ransomware, rooted host, accidental `rm -rf`) would destroy both the primary data and every recovery point simultaneously. That is the #1 actual-risk gap in `RISK_REGISTER.md` (R-003, raw rating 10).

After this change:

- Every daily backup is encrypted (AES-256-CBC application-layer) and uploaded to a versioned, KMS-encrypted S3 bucket in a **different AWS region** (default `us-west-2` — primary is `us-east-1`).
- The bucket has **public access blocked**, **versioning on**, and a lifecycle policy transitioning to STANDARD_IA at 90 days.
- The EC2 host holds **only write-credentials** (IAM user `insighthub-backup-writer` with `PutObject` + KMS `GenerateDataKey` — **not** `DeleteObject`, **not** `GetObject`, **not** `ListBucket`).
- **Read credentials** live in your password manager and are used only for restore operations via `scripts/restore-from-s3.sh`.
- An attacker who roots the EC2 host cannot read historical backups (no read perm), cannot delete them (no delete perm), and cannot list them (no list perm). They can only add new objects — which is harmless because versioning preserves the prior objects.

This is **asymmetric isolation**: write from the trusted zone, read from the recovery zone, and never mix the two.

---

## 2. Prerequisites

On the operator's machine (Jeff's MacBook):

- AWS CLI v2 installed: `aws --version` should print ≥ 2.0.
- AWS credentials configured with an **admin-capable profile** (the profile you will use to create resources). Typical setup: `aws configure --profile admin`.
- `jq` installed: `brew install jq`.
- A password manager at hand (1Password, Bitwarden, etc.) — you will paste 4 secret strings into it.

On the production EC2 host (`autoqa`):

- AWS CLI v2 installed: `ssh jeffreycoy@autoqa aws --version`. If not, install via `sudo apt install awscli` (Ubuntu) or upgrade to v2 per AWS docs.
- `/opt/insighthub/.env.local` exists and is owned by `jeffreycoy:jeffreycoy` with permissions `600`.

---

## 3. One-time setup

### Step 1. Run the bootstrap script

From your local machine:

```bash
AWS_PROFILE=admin ./scripts/setup-backup-isolation.sh
```

Optional overrides:

```bash
BACKUP_REGION=us-west-2 \
BACKUP_BUCKET_PREFIX=insighthub-backups-isolated \
BACKUP_KMS_ALIAS=alias/insighthub-backups \
AWS_PROFILE=admin \
./scripts/setup-backup-isolation.sh
```

The script is idempotent — safe to re-run. It will:

1. Create (or verify) a KMS customer-managed key in `us-west-2` with **annual key rotation enabled**.
2. Create (or verify) an S3 bucket `insighthub-backups-isolated-<ACCOUNT_ID>` in `us-west-2` with:
   - Versioning enabled.
   - Default SSE-KMS encryption using the new KMS key.
   - All public access blocked.
   - Lifecycle policy: STANDARD_IA @ 90 days, non-current versions expire @ 2 years.
3. Create an IAM user `insighthub-backup-writer` with an inline policy granting **only** `s3:PutObject` on this bucket and `kms:Encrypt` / `kms:GenerateDataKey` on the KMS key.
4. Create an IAM user `insighthub-backup-reader` with an inline policy granting `s3:Get*`, `s3:List*`, and `kms:Decrypt` on the bucket and key.
5. Generate access keys for both users (only if they don't already have keys).

**At the end, the script prints all 4 access keys.** Save them immediately.

### Step 2. Enable MFA-delete (manual — one-time)

AWS does not allow enabling MFA-delete through an IAM user API call. It requires **root-account credentials and an MFA serial**. Log in to the AWS root account, set up an MFA device if one isn't present, then:

```bash
aws s3api put-bucket-versioning \
    --bucket insighthub-backups-isolated-<ACCOUNT_ID> \
    --region us-west-2 \
    --versioning-configuration Status=Enabled,MFADelete=Enabled \
    --mfa "<root-mfa-serial> <current-6-digit-code>"
```

Where `<root-mfa-serial>` looks like `arn:aws:iam::<ACCOUNT_ID>:mfa/root-account-mfa-device`.

After this step, a deletion of a bucket version requires the root account's MFA code. Confirm with:

```bash
aws s3api get-bucket-versioning \
    --bucket insighthub-backups-isolated-<ACCOUNT_ID> \
    --region us-west-2
```

You should see `"MFADelete": "Enabled"`.

### Step 3. Save credentials to password manager

From the output of Step 1, save to 1Password (or your password manager) as separate entries:

- **Entry: "InsightHub Backup Writer (EC2)"** — `ACCESS_KEY_ID` + `SECRET_ACCESS_KEY`. Marked with tag `insighthub-ec2`.
- **Entry: "InsightHub Backup Reader (restore-only)"** — `ACCESS_KEY_ID` + `SECRET_ACCESS_KEY`. Marked with tag `insighthub-restore-only`. **Critical:** this entry must not be anywhere near the EC2 host.

### Step 4. Install writer credentials on EC2

```bash
ssh jeffreycoy@autoqa

cd /opt/insighthub
# Edit .env.local (make sure it's already at chmod 600):
nano .env.local
```

Add to the file:

```bash
BACKUP_REGION=us-west-2
BACKUP_S3_BUCKET=insighthub-backups-isolated-<ACCOUNT_ID>
BACKUP_KMS_KEY_ID=<key-id-from-script-output>
BACKUP_WRITER_AWS_ACCESS_KEY_ID=<writer-access-key-from-step-1>
BACKUP_WRITER_AWS_SECRET_ACCESS_KEY=<writer-secret-from-step-1>
# Ensure BACKUP_ENCRYPTION_KEY is ALSO set — now mandatory:
BACKUP_ENCRYPTION_KEY=<openssl-rand-base64-32-output>
```

Verify:

```bash
chmod 600 .env.local
ls -la .env.local    # expect: -rw------- 1 jeffreycoy jeffreycoy
```

### Step 5. Verify end-to-end

From your local machine:

```bash
./scripts/backup-db.sh --remote-only
```

Expected output includes:

```
  ✓ Backup created: insighthub-YYYYMMDD-HHMMSS.db
  ✓ Encrypted → insighthub-YYYYMMDD-HHMMSS.db.enc
  Uploading to s3://insighthub-backups-isolated-<id>/YYYY/MM/DD/insighthub-YYYYMMDD-HHMMSS.db.enc (region=us-west-2)...
  ✓ Uploaded to s3://insighthub-backups-isolated-<id>/YYYY/MM/DD/insighthub-YYYYMMDD-HHMMSS.db.enc
```

List what landed in the bucket using reader credentials from your password manager:

```bash
# In a terminal, load reader creds just for this session — do NOT persist them.
export BACKUP_READER_AWS_ACCESS_KEY_ID=<reader-key>
export BACKUP_READER_AWS_SECRET_ACCESS_KEY=<reader-secret>
export BACKUP_S3_BUCKET=insighthub-backups-isolated-<id>
export BACKUP_ENCRYPTION_KEY=<same-as-ec2>
./scripts/restore-from-s3.sh --list
unset BACKUP_READER_AWS_ACCESS_KEY_ID BACKUP_READER_AWS_SECRET_ACCESS_KEY
```

You should see your uploaded backup with a recent `LastModified` timestamp.

### Step 6. Trigger a test restore (highly recommended)

Pick a backup, download + decrypt without restoring to production:

```bash
export BACKUP_READER_AWS_ACCESS_KEY_ID=<reader-key>
export BACKUP_READER_AWS_SECRET_ACCESS_KEY=<reader-secret>
export BACKUP_S3_BUCKET=insighthub-backups-isolated-<id>
export BACKUP_ENCRYPTION_KEY=<same-as-ec2>
./scripts/restore-from-s3.sh --download 2026/04/24/insighthub-20260424-030000.db.enc
unset BACKUP_READER_AWS_ACCESS_KEY_ID BACKUP_READER_AWS_SECRET_ACCESS_KEY
```

Verify the decrypted file is a valid SQLite DB: `sqlite3 backups/insighthub-20260424-030000.db '.tables'` should list all InsightHub tables.

**Record this test in `docs/BACKUP_RESTORE_TEST_2026-Q2.md`.** That artifact partially closes gap G-27 (annual restore test) whenever the first production restore is verified.

---

## 4. Operating model going forward

### Daily backup cron (already in place on EC2)

```bash
0 3 * * * /opt/insighthub/scripts/backup-db.sh --remote-only >> /var/log/insighthub-backup.log 2>&1
```

With `BACKUP_S3_BUCKET` set in `/opt/insighthub/.env.local`, every run now:
1. Creates a backup on EC2.
2. Encrypts it (AES-256-CBC, PBKDF2 100k iters).
3. Uploads it to S3 with SSE-KMS.
4. Prunes local copies older than 30 days (S3 lifecycle handles the S3 side).

### When a deploy is made

`deploy.sh` now refuses to deploy to the production host (`EC2_HOST=autoqa`) if any of these are missing on EC2:

- `BACKUP_ENCRYPTION_KEY`
- `BACKUP_S3_BUCKET`
- `BACKUP_KMS_KEY_ID`
- `BACKUP_WRITER_AWS_ACCESS_KEY_ID`
- `BACKUP_WRITER_AWS_SECRET_ACCESS_KEY`

Bypass (emergency only, document the exception in the risk register):

```bash
SKIP_PREFLIGHT=true ./deploy.sh
```

### During an incident

See `docs/INCIDENT_RESPONSE_RUNBOOK.md` §6.2 (production host compromise). Restore procedure:

```bash
# From Jeff's MacBook, load reader credentials from password manager:
export BACKUP_READER_AWS_ACCESS_KEY_ID=<reader-key>
export BACKUP_READER_AWS_SECRET_ACCESS_KEY=<reader-secret>
export BACKUP_S3_BUCKET=insighthub-backups-isolated-<id>
export BACKUP_ENCRYPTION_KEY=<key>

# 1. Pick the newest pre-compromise backup:
./scripts/restore-from-s3.sh --list

# 2. Restore it:
./scripts/restore-from-s3.sh --restore 2026/04/22/insighthub-20260422-030000.db.enc

unset BACKUP_READER_AWS_ACCESS_KEY_ID BACKUP_READER_AWS_SECRET_ACCESS_KEY BACKUP_ENCRYPTION_KEY
```

### Key rotation

- **KMS key:** AWS rotates annually (enabled by the bootstrap script). No manual action.
- **IAM access keys:** Rotate every 90 days. Runbook:
  1. `aws iam create-access-key --user-name insighthub-backup-writer` (second active key is allowed).
  2. Update EC2 `.env.local` with the new key.
  3. Wait 24 hours, verify backups succeeding on the new key.
  4. `aws iam delete-access-key --user-name insighthub-backup-writer --access-key-id <old-id>`.
  5. Commit the rotation to `docs/SECRETS_ROTATION_LOG.md` (create if missing).
- **Encryption key (`BACKUP_ENCRYPTION_KEY`):** Rotating this breaks decrypt for older backups. If rotation is needed, keep the old key stored separately (labeled by date range) so older backups remain recoverable.

### Cost

At InsightHub's scale (~20 MB database × 365 backups/year = ~7 GB/year):

- S3 Standard (90 days): negligible (< $0.50/month).
- S3 Standard-IA (after 90 days): ~$0.10/month.
- KMS key: $1/month (fixed).
- KMS API calls: negligible at this scale.
- Data transfer (same-region upload from EC2 us-east-1 to S3 us-west-2): ~$0.02/GB cross-region × 7 GB/year ≈ $0.14/year.

**All-in: < $15/year** for the asymmetric-isolation property.

---

## 5. Teardown

If you ever need to completely remove this setup (unusual — only if decommissioning InsightHub entirely):

```bash
AWS_PROFILE=admin ./scripts/setup-backup-isolation.sh --teardown
```

You will be prompted to type `TEARDOWN` to confirm. The KMS key deletion is scheduled with the 30-day waiting period (the AWS minimum) to allow recovery of older backups if needed.

---

## 6. Audit evidence

To produce audit evidence of the isolation property:

```bash
# Bucket is in a separate region:
aws s3api get-bucket-location --bucket insighthub-backups-isolated-<id>

# Versioning + MFA-delete:
aws s3api get-bucket-versioning --bucket insighthub-backups-isolated-<id> --region us-west-2

# Default encryption:
aws s3api get-bucket-encryption --bucket insighthub-backups-isolated-<id> --region us-west-2

# Public access blocked:
aws s3api get-public-access-block --bucket insighthub-backups-isolated-<id> --region us-west-2

# Writer IAM user CANNOT list or delete:
aws iam get-user-policy --user-name insighthub-backup-writer --policy-name InsightHubBackupWrite
```

Capture the output in `docs/audit-evidence/backup-isolation-YYYY-MM.txt` annually.

---

## 7. Risk register impact

Upon completion of steps 1-5, update `docs/RISK_REGISTER.md`:

- **R-003** status: Open → Monitoring (residual 4 from 10).
- **R-017** (no restore test) moves to In Progress after Step 6 is performed; Closed after Step 6 is scheduled annually.

---

## 8. Review history

| Date | Reviewer | Summary |
|---|---|---|
| 2026-04-24 | Jeff Coy | Initial runbook created as part of gap G-13 closure. Script, code changes, and documentation committed in one go. AWS setup pending operator execution. |
