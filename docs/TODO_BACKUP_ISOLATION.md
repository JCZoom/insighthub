# TODO: Complete backup-isolation provisioning (gap G-13)

**Status:** BLOCKED on AWS IAM permissions
**Owner:** TBD (needs someone with admin AWS access on account `734910107398`)
**Tracking for:** `SKIP_PREFLIGHT=true` bypass currently in use by `deploy.sh`

---

## What's done

- Application code for cross-region encrypted backups shipped in commit
  `e46124b` (`feat(backup): cross-region isolated backups (G-13) — code + runbook`).
- `deploy.sh` enforces a pre-flight check that refuses to deploy unless
  the backup-isolation env vars exist on EC2.
- Provisioning automation exists at `scripts/setup-backup-isolation.sh`.
- Operator runbook exists at `docs/BACKUP_ISOLATION_SETUP.md`.

## What's blocking

The current local AWS identity (`arn:aws:iam::734910107398:user/jeffreycoy-lambda-cli`)
is purpose-built for Lambda CLI work and **does not have permission to
create IAM users, KMS keys, or S3 buckets**. Specifically, it can't even
call `iam:ListAttachedUserPolicies` on itself.

As a result, deploys on this workstation require the documented
`SKIP_PREFLIGHT=true` bypass, which means **the production EC2 host is
running without the cross-region isolated backup configured**. Local
`backups/` snapshots still exist (see `backup-db.sh`), but there's no
offsite/encrypted copy in a separate region yet.

## Who can unblock this

Anyone with (at minimum) these AWS permissions on account `734910107398`:

- `iam:CreateUser`, `iam:PutUserPolicy`, `iam:CreateAccessKey` (for the
  two backup users)
- `kms:CreateKey`, `kms:CreateAlias`, `kms:EnableKeyRotation`
- `s3:CreateBucket`, `s3:PutBucketVersioning`, `s3:PutBucketEncryption`,
  `s3:PutBucketPublicAccessBlock`, `s3:PutLifecycleConfiguration`

In practice that's `AdministratorAccess` or a similar broad role. An SSO
session from the account owner is usually the easiest path.

## Steps to complete

1. **Get admin AWS credentials** configured locally (`aws configure --profile admin`
   or assume an admin role via SSO).
2. **Dry-run to confirm:**
   ```bash
   AWS_PROFILE=admin ./scripts/setup-backup-isolation.sh --dry-run
   ```
3. **Run for real** (creates KMS key, S3 bucket, IAM users + access keys):
   ```bash
   AWS_PROFILE=admin ./scripts/setup-backup-isolation.sh > .backup-secrets.txt 2>&1
   ```
   The secrets summary is in `.backup-secrets.txt`. **Do NOT commit this file** —
   it's already matched by the generic `.env*` pattern but double-check `git status`.
4. **Generate the encryption key:**
   ```bash
   openssl rand -base64 32
   ```
5. **Copy the 4 AWS values + encryption key into 1Password** under an entry
   named `InsightHub backup-isolation secrets`.
6. **SSH to EC2 and add to `/opt/insighthub/.env.local`:**
   ```
   BACKUP_REGION=us-west-2
   BACKUP_S3_BUCKET=insighthub-backups-isolated-734910107398
   BACKUP_KMS_KEY_ID=<key-id-from-step-3>
   BACKUP_WRITER_AWS_ACCESS_KEY_ID=<from-step-3>
   BACKUP_WRITER_AWS_SECRET_ACCESS_KEY=<from-step-3>
   BACKUP_ENCRYPTION_KEY=<from-step-4>
   ```
   Reader creds go into 1Password only — never on EC2.
7. **Enable MFA-delete on the bucket** (requires AWS root creds — account
   owner only):
   ```bash
   aws s3api put-bucket-versioning \
     --bucket insighthub-backups-isolated-734910107398 --region us-west-2 \
     --versioning-configuration Status=Enabled,MFADelete=Enabled \
     --mfa "<root-account-mfa-serial> <current-otp-code>"
   ```
8. **Test the end-to-end backup:**
   ```bash
   ssh jeffreycoy@autoqa "cd /opt/insighthub && ./scripts/backup-db.sh"
   ```
   Then confirm the object appears in the S3 bucket.
9. **Remove the `SKIP_PREFLIGHT=true` bypass** — next `./deploy.sh`
   should succeed without it, confirming the secrets are all in place.
10. **Delete `.backup-secrets.txt`** from the local machine:
    ```bash
    shred -u .backup-secrets.txt 2>/dev/null || rm -P .backup-secrets.txt
    ```

## Risk while unresolved

- **No offsite backup.** If the EC2 box is compromised or the region has
  an outage, the only recovery path is the local `backups/` directory on
  the same host — which means if the host is lost, so are the backups.
- **ISO 27001 / ISMS compliance gap G-13 remains open.** This was the
  original reason for the work; the code is shipped but the infrastructure
  provisioning is incomplete.
- **Risk window starts at next live incident.** Every day of bypass
  extends the exposure.

Target: resolve within two weeks of this file's creation date.
