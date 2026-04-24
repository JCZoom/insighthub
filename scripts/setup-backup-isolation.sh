#!/bin/bash
# Bootstrap cross-region isolated backups for InsightHub (gap G-13).
#
# Creates, idempotently:
#   - KMS customer-managed key in us-west-2 for backup encryption at rest.
#   - S3 bucket in us-west-2 with versioning, default SSE-KMS, and public access blocked.
#   - Lifecycle policy: transition to STANDARD_IA after 90 days, expire non-current versions after 2 years.
#   - IAM user `insighthub-backup-writer` with minimal PutObject/KMS policy.
#   - IAM user `insighthub-backup-reader` for restore operations (GetObject/List/KMS decrypt).
#
# Does NOT do (requires manual steps documented in docs/BACKUP_ISOLATION_SETUP.md):
#   - Enable MFA-delete on the bucket (must be done with root credentials; AWS restriction).
#   - Rotate the access keys into AWS Secrets Manager (gap G-36).
#
# Requirements:
#   - AWS CLI v2 configured with credentials that can create S3/KMS/IAM resources
#     (typically an admin IAM user or SSO session).
#   - jq installed locally.
#
# Usage:
#   AWS_PROFILE=admin ./scripts/setup-backup-isolation.sh
#   AWS_PROFILE=admin ./scripts/setup-backup-isolation.sh --dry-run
#   AWS_PROFILE=admin ./scripts/setup-backup-isolation.sh --teardown   # caution
set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────
REGION="${BACKUP_REGION:-us-west-2}"
BUCKET_PREFIX="${BACKUP_BUCKET_PREFIX:-insighthub-backups-isolated}"
KMS_ALIAS="${BACKUP_KMS_ALIAS:-alias/insighthub-backups}"
WRITER_USER="insighthub-backup-writer"
READER_USER="insighthub-backup-reader"

# Parse flags
DRY_RUN=false
TEARDOWN=false
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=true ;;
        --teardown) TEARDOWN=true ;;
        -h|--help)
            grep -E '^#( |$)' "$0" | sed 's/^# \?//'
            exit 0
            ;;
    esac
done

run() {
    if [ "$DRY_RUN" = true ]; then
        echo "  [dry-run] $*"
    else
        "$@"
    fi
}

# ── Preflight ────────────────────────────────────────────────────────
command -v aws >/dev/null 2>&1 || { echo "ERROR: aws CLI not installed"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "ERROR: jq not installed"; exit 1; }

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "=== InsightHub Backup Isolation Setup ==="
echo "  AWS Account:    $ACCOUNT_ID"
echo "  Region:         $REGION"
echo "  KMS alias:      $KMS_ALIAS"
echo "  Bucket prefix:  $BUCKET_PREFIX"
echo "  Dry run:        $DRY_RUN"
echo "  Teardown:       $TEARDOWN"
echo ""

# Bucket name must be globally unique. Include account ID suffix for uniqueness.
BUCKET_NAME="${BUCKET_PREFIX}-${ACCOUNT_ID}"

# ── Teardown mode ────────────────────────────────────────────────────
if [ "$TEARDOWN" = true ]; then
    echo "!! TEARDOWN MODE !!"
    echo "This will delete the S3 bucket, KMS key (schedule deletion with 30-day window), and IAM users."
    echo "Type 'TEARDOWN' (case sensitive) to confirm:"
    read -r CONFIRM
    if [ "$CONFIRM" != "TEARDOWN" ]; then
        echo "Aborted."
        exit 1
    fi

    # Empty bucket (versioned objects + delete markers)
    if aws s3api head-bucket --bucket "$BUCKET_NAME" --region "$REGION" 2>/dev/null; then
        echo "Deleting all versions in $BUCKET_NAME..."
        aws s3api delete-objects --bucket "$BUCKET_NAME" --region "$REGION" \
            --delete "$(aws s3api list-object-versions --bucket "$BUCKET_NAME" --region "$REGION" \
                --output json --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}, Quiet:`false`}')" \
            2>/dev/null || true
        aws s3api delete-objects --bucket "$BUCKET_NAME" --region "$REGION" \
            --delete "$(aws s3api list-object-versions --bucket "$BUCKET_NAME" --region "$REGION" \
                --output json --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}, Quiet:`false`}')" \
            2>/dev/null || true
        run aws s3api delete-bucket --bucket "$BUCKET_NAME" --region "$REGION"
    fi

    # Detach + delete IAM users
    for user in "$WRITER_USER" "$READER_USER"; do
        if aws iam get-user --user-name "$user" >/dev/null 2>&1; then
            for policy_arn in $(aws iam list-attached-user-policies --user-name "$user" --query 'AttachedPolicies[].PolicyArn' --output text); do
                run aws iam detach-user-policy --user-name "$user" --policy-arn "$policy_arn"
            done
            for policy_name in $(aws iam list-user-policies --user-name "$user" --query 'PolicyNames[]' --output text); do
                run aws iam delete-user-policy --user-name "$user" --policy-name "$policy_name"
            done
            for key_id in $(aws iam list-access-keys --user-name "$user" --query 'AccessKeyMetadata[].AccessKeyId' --output text); do
                run aws iam delete-access-key --user-name "$user" --access-key-id "$key_id"
            done
            run aws iam delete-user --user-name "$user"
        fi
    done

    # Schedule KMS key deletion (30-day waiting period, minimum)
    KEY_ID=$(aws kms describe-key --key-id "$KMS_ALIAS" --region "$REGION" --query 'KeyMetadata.KeyId' --output text 2>/dev/null || echo "")
    if [ -n "$KEY_ID" ]; then
        run aws kms delete-alias --alias-name "$KMS_ALIAS" --region "$REGION" 2>/dev/null || true
        run aws kms schedule-key-deletion --key-id "$KEY_ID" --pending-window-in-days 30 --region "$REGION"
        echo "  KMS key scheduled for deletion in 30 days ($KEY_ID)."
    fi

    echo "Teardown complete."
    exit 0
fi

# ── 1. KMS key ───────────────────────────────────────────────────────
echo "[1/5] Creating/verifying KMS key..."
if aws kms describe-key --key-id "$KMS_ALIAS" --region "$REGION" >/dev/null 2>&1; then
    KEY_ID=$(aws kms describe-key --key-id "$KMS_ALIAS" --region "$REGION" --query 'KeyMetadata.KeyId' --output text)
    echo "  ✓ Exists: $KEY_ID"
else
    if [ "$DRY_RUN" = false ]; then
        KEY_ID=$(aws kms create-key \
            --description "InsightHub isolated backup encryption (gap G-13)" \
            --key-usage ENCRYPT_DECRYPT \
            --key-spec SYMMETRIC_DEFAULT \
            --tags TagKey=Project,TagValue=InsightHub TagKey=Purpose,TagValue=BackupIsolation \
            --region "$REGION" \
            --query 'KeyMetadata.KeyId' --output text)
        aws kms create-alias \
            --alias-name "$KMS_ALIAS" \
            --target-key-id "$KEY_ID" \
            --region "$REGION"
        aws kms enable-key-rotation --key-id "$KEY_ID" --region "$REGION"
        echo "  ✓ Created: $KEY_ID (annual rotation enabled)"
    else
        KEY_ID="(would-be-created)"
        echo "  [dry-run] would create KMS key and alias $KMS_ALIAS"
    fi
fi

# ── 2. S3 bucket ─────────────────────────────────────────────────────
echo "[2/5] Creating/verifying S3 bucket $BUCKET_NAME..."
if aws s3api head-bucket --bucket "$BUCKET_NAME" --region "$REGION" 2>/dev/null; then
    echo "  ✓ Exists"
else
    if [ "$REGION" = "us-east-1" ]; then
        run aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$REGION"
    else
        run aws s3api create-bucket \
            --bucket "$BUCKET_NAME" --region "$REGION" \
            --create-bucket-configuration "LocationConstraint=$REGION"
    fi
    echo "  ✓ Created"
fi

echo "  Enabling versioning..."
run aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" --region "$REGION" \
    --versioning-configuration Status=Enabled

echo "  Blocking public access..."
run aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" --region "$REGION" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo "  Applying default SSE-KMS encryption..."
if [ "$DRY_RUN" = false ]; then
    ENCRYPTION_CONFIG=$(jq -n --arg kms "$KEY_ID" '
        {
            Rules: [
                {
                    ApplyServerSideEncryptionByDefault: {
                        SSEAlgorithm: "aws:kms",
                        KMSMasterKeyID: $kms
                    },
                    BucketKeyEnabled: true
                }
            ]
        }')
    aws s3api put-bucket-encryption \
        --bucket "$BUCKET_NAME" --region "$REGION" \
        --server-side-encryption-configuration "$ENCRYPTION_CONFIG"
fi

echo "  Applying lifecycle policy (IA @ 90d, expire non-current @ 2y)..."
LIFECYCLE_CONFIG='{
    "Rules": [
        {
            "ID": "insighthub-backup-lifecycle",
            "Status": "Enabled",
            "Filter": {"Prefix": ""},
            "Transitions": [
                {"Days": 90, "StorageClass": "STANDARD_IA"}
            ],
            "NoncurrentVersionExpiration": {"NoncurrentDays": 730}
        }
    ]
}'
if [ "$DRY_RUN" = false ]; then
    aws s3api put-bucket-lifecycle-configuration \
        --bucket "$BUCKET_NAME" --region "$REGION" \
        --lifecycle-configuration "$LIFECYCLE_CONFIG"
fi
echo "  ✓ Bucket configured"

# ── 3. Writer IAM user ───────────────────────────────────────────────
echo "[3/5] Creating/verifying IAM writer user..."
if aws iam get-user --user-name "$WRITER_USER" >/dev/null 2>&1; then
    echo "  ✓ User exists: $WRITER_USER"
else
    run aws iam create-user --user-name "$WRITER_USER" \
        --tags Key=Project,Value=InsightHub Key=Role,Value=BackupWriter
    echo "  ✓ Created: $WRITER_USER"
fi

WRITER_POLICY=$(jq -n --arg bucket "$BUCKET_NAME" --arg kms_arn "arn:aws:kms:${REGION}:${ACCOUNT_ID}:key/${KEY_ID}" '
{
    Version: "2012-10-17",
    Statement: [
        {
            Sid: "AllowPutOnly",
            Effect: "Allow",
            Action: ["s3:PutObject"],
            Resource: ("arn:aws:s3:::" + $bucket + "/*")
        },
        {
            Sid: "AllowKmsEncrypt",
            Effect: "Allow",
            Action: ["kms:Encrypt", "kms:GenerateDataKey"],
            Resource: $kms_arn
        }
    ]
}')
if [ "$DRY_RUN" = false ]; then
    aws iam put-user-policy \
        --user-name "$WRITER_USER" \
        --policy-name "InsightHubBackupWrite" \
        --policy-document "$WRITER_POLICY"
fi
echo "  ✓ Writer policy attached (PutObject only — no Delete, no List)"

# ── 4. Reader IAM user ───────────────────────────────────────────────
echo "[4/5] Creating/verifying IAM reader user..."
if aws iam get-user --user-name "$READER_USER" >/dev/null 2>&1; then
    echo "  ✓ User exists: $READER_USER"
else
    run aws iam create-user --user-name "$READER_USER" \
        --tags Key=Project,Value=InsightHub Key=Role,Value=BackupReader
    echo "  ✓ Created: $READER_USER"
fi

READER_POLICY=$(jq -n --arg bucket "$BUCKET_NAME" --arg kms_arn "arn:aws:kms:${REGION}:${ACCOUNT_ID}:key/${KEY_ID}" '
{
    Version: "2012-10-17",
    Statement: [
        {
            Sid: "AllowListBucket",
            Effect: "Allow",
            Action: ["s3:ListBucket", "s3:ListBucketVersions"],
            Resource: ("arn:aws:s3:::" + $bucket)
        },
        {
            Sid: "AllowGet",
            Effect: "Allow",
            Action: ["s3:GetObject", "s3:GetObjectVersion"],
            Resource: ("arn:aws:s3:::" + $bucket + "/*")
        },
        {
            Sid: "AllowKmsDecrypt",
            Effect: "Allow",
            Action: ["kms:Decrypt"],
            Resource: $kms_arn
        }
    ]
}')
if [ "$DRY_RUN" = false ]; then
    aws iam put-user-policy \
        --user-name "$READER_USER" \
        --policy-name "InsightHubBackupRead" \
        --policy-document "$READER_POLICY"
fi
echo "  ✓ Reader policy attached (GetObject/List + KMS Decrypt)"

# ── 5. Access keys ───────────────────────────────────────────────────
echo "[5/5] Access keys..."
if [ "$DRY_RUN" = true ]; then
    echo "  [dry-run] skipping access-key generation"
else
    # Only generate keys if user has none.
    WRITER_KEYS_COUNT=$(aws iam list-access-keys --user-name "$WRITER_USER" --query 'length(AccessKeyMetadata)')
    READER_KEYS_COUNT=$(aws iam list-access-keys --user-name "$READER_USER" --query 'length(AccessKeyMetadata)')
    if [ "$WRITER_KEYS_COUNT" -eq 0 ]; then
        WRITER_KEY_JSON=$(aws iam create-access-key --user-name "$WRITER_USER")
        WRITER_ACCESS_KEY=$(echo "$WRITER_KEY_JSON" | jq -r '.AccessKey.AccessKeyId')
        WRITER_SECRET=$(echo "$WRITER_KEY_JSON" | jq -r '.AccessKey.SecretAccessKey')
    else
        WRITER_ACCESS_KEY="(existing — not re-generated)"
        WRITER_SECRET="(existing — not re-generated)"
    fi
    if [ "$READER_KEYS_COUNT" -eq 0 ]; then
        READER_KEY_JSON=$(aws iam create-access-key --user-name "$READER_USER")
        READER_ACCESS_KEY=$(echo "$READER_KEY_JSON" | jq -r '.AccessKey.AccessKeyId')
        READER_SECRET=$(echo "$READER_KEY_JSON" | jq -r '.AccessKey.SecretAccessKey')
    else
        READER_ACCESS_KEY="(existing — not re-generated)"
        READER_SECRET="(existing — not re-generated)"
    fi
fi

# ── Summary ──────────────────────────────────────────────────────────
cat <<EOF

════════════════════════════════════════════════════════════════════════
  SETUP COMPLETE — SAVE THESE VALUES IMMEDIATELY
════════════════════════════════════════════════════════════════════════

Add to EC2's /opt/insighthub/.env.local:

    BACKUP_REGION=$REGION
    BACKUP_S3_BUCKET=$BUCKET_NAME
    BACKUP_KMS_KEY_ID=$KEY_ID
    BACKUP_WRITER_AWS_ACCESS_KEY_ID=${WRITER_ACCESS_KEY:-<see IAM console>}
    BACKUP_WRITER_AWS_SECRET_ACCESS_KEY=${WRITER_SECRET:-<see IAM console>}

Store separately (ONLY needed when performing a restore — keep OFF of EC2):

    BACKUP_READER_AWS_ACCESS_KEY_ID=${READER_ACCESS_KEY:-<see IAM console>}
    BACKUP_READER_AWS_SECRET_ACCESS_KEY=${READER_SECRET:-<see IAM console>}

════════════════════════════════════════════════════════════════════════
NEXT STEPS (manual — cannot be automated):
  1. Enable MFA-delete on the bucket (requires AWS root credentials):
       aws s3api put-bucket-versioning \\
         --bucket $BUCKET_NAME --region $REGION \\
         --versioning-configuration Status=Enabled,MFADelete=Enabled \\
         --mfa "<root-account-mfa-serial> <current-otp-code>"
  2. Save all 4 access keys to your password manager (1Password).
  3. Clear the values above from your terminal scrollback.
  4. Migrate BACKUP_* secrets to AWS Secrets Manager (gap G-36) — future work.
  5. Run a test backup to verify end-to-end:
       BACKUP_REGION=$REGION BACKUP_S3_BUCKET=$BUCKET_NAME ./scripts/backup-db.sh
════════════════════════════════════════════════════════════════════════
EOF
