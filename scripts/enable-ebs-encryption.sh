#!/bin/bash
# Enable EBS volume encryption for the InsightHub EC2 instance
#
# This script:
#   1. Enables default EBS encryption for the region
#   2. Checks current volume encryption status
#   3. If unencrypted, migrates to encrypted volumes via snapshot+copy
#   4. Verifies the migration
#
# Usage:
#   SSH into EC2, then: sudo bash /opt/insighthub/scripts/enable-ebs-encryption.sh
#   Or remotely: ssh jeffreycoy@autoqa 'sudo bash /opt/insighthub/scripts/enable-ebs-encryption.sh'
#
# Prerequisites:
#   - AWS CLI v2 installed on the instance
#   - IAM permissions: ec2:Describe*, ec2:CreateSnapshot, ec2:CopySnapshot,
#     ec2:CreateVolume, ec2:AttachVolume, ec2:DetachVolume, ec2:StopInstances,
#     ec2:StartInstances, ec2:EnableEbsEncryptionByDefault, ec2:GetEbsEncryptionByDefault,
#     ec2:DeleteSnapshot, ec2:DeleteVolume, ec2:ModifyInstanceAttribute
#   - Instance profile with above permissions OR aws configure with access keys
#
# CISO Report §6.1 — Data at Rest Encryption
# Asana Task: 🔒 Verify & Enable EBS Volume Encryption on EC2 (CISO §6.1)
#
set -euo pipefail

# ── Configuration ──────────────────────────────────────────
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="/tmp/ebs-encryption-${TIMESTAMP}.log"

# Auto-detect instance ID and region from metadata
TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/instance-id)
AZ=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/placement/availability-zone)
REGION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/placement/region)

log() {
    local msg="[$(date '+%H:%M:%S')] $*"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE"
}

fail() {
    log "ERROR: $*"
    exit 1
}

log "=== EBS Encryption — InsightHub EC2 ==="
log "  Instance:  $INSTANCE_ID"
log "  AZ:        $AZ"
log "  Region:    $REGION"
log "  Timestamp: $TIMESTAMP"
log "  Log file:  $LOG_FILE"
log ""

# ── Step 1: Enable default EBS encryption ─────────────────
log "[1/6] Checking default EBS encryption for region $REGION..."
DEFAULT_ENC=$(aws ec2 get-ebs-encryption-by-default \
    --region "$REGION" \
    --query 'EbsEncryptionByDefault' \
    --output text 2>>"$LOG_FILE")

if [ "$DEFAULT_ENC" = "True" ]; then
    log "  ✓ Default EBS encryption already enabled"
else
    log "  Enabling default EBS encryption for $REGION..."
    aws ec2 enable-ebs-encryption-by-default --region "$REGION" >> "$LOG_FILE" 2>&1
    log "  ✓ Default EBS encryption enabled — all new volumes will be encrypted"
fi
log ""

# ── Step 2: Check current volume encryption status ────────
log "[2/6] Checking attached volume encryption status..."

VOLUME_IDS=$(aws ec2 describe-instances \
    --region "$REGION" \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].BlockDeviceMappings[].Ebs.VolumeId' \
    --output text 2>>"$LOG_FILE")

[ -z "$VOLUME_IDS" ] && fail "No EBS volumes found for $INSTANCE_ID"

UNENCRYPTED_VOLS=()
ALL_VOLS=()

for VOL_ID in $VOLUME_IDS; do
    VOL_INFO=$(aws ec2 describe-volumes \
        --region "$REGION" \
        --volume-ids "$VOL_ID" \
        --query 'Volumes[0].[VolumeId, Encrypted, Size, VolumeType, Attachments[0].Device]' \
        --output text 2>>"$LOG_FILE")

    ENCRYPTED=$(echo "$VOL_INFO" | awk '{print $2}')
    SIZE=$(echo "$VOL_INFO" | awk '{print $3}')
    TYPE=$(echo "$VOL_INFO" | awk '{print $4}')
    DEVICE=$(echo "$VOL_INFO" | awk '{print $5}')

    ALL_VOLS+=("$VOL_ID")

    if [ "$ENCRYPTED" = "True" ]; then
        log "  ✓ $VOL_ID ($DEVICE) — ENCRYPTED ($SIZE GB, $TYPE)"
    else
        log "  ✗ $VOL_ID ($DEVICE) — NOT ENCRYPTED ($SIZE GB, $TYPE)"
        UNENCRYPTED_VOLS+=("$VOL_ID:$DEVICE:$SIZE:$TYPE")
    fi
done
log ""

if [ ${#UNENCRYPTED_VOLS[@]} -eq 0 ]; then
    log "=== All volumes are already encrypted ==="
    log "  CISO Report §6.1: ✅ RESOLVED"
    exit 0
fi

log "Found ${#UNENCRYPTED_VOLS[@]} unencrypted volume(s). Starting migration..."
log ""

# ── Step 3: Pre-migration — backup the application ────────
log "[3/6] Pre-migration safety checks..."
log "  Stopping InsightHub service to ensure data consistency..."
sudo systemctl stop insighthub 2>>"$LOG_FILE" || log "  (service not running or already stopped)"
sleep 3

# Sync filesystem to flush writes
sync
log "  ✓ Filesystem synced, service stopped"
log ""

# ── Step 4: Stop the instance for volume swap ─────────────
log "[4/6] Stopping instance for volume migration..."
log "  ⚠ This will cause a brief outage (~5-10 minutes)"
log ""

aws ec2 stop-instances \
    --region "$REGION" \
    --instance-ids "$INSTANCE_ID" >> "$LOG_FILE" 2>&1

log "  Waiting for instance to stop..."
aws ec2 wait instance-stopped \
    --region "$REGION" \
    --instance-ids "$INSTANCE_ID" 2>>"$LOG_FILE"
log "  ✓ Instance stopped"
log ""

# ── Step 5: Migrate each unencrypted volume ───────────────
log "[5/6] Migrating unencrypted volumes to encrypted copies..."

for VOL_ENTRY in "${UNENCRYPTED_VOLS[@]}"; do
    IFS=':' read -r VOL_ID DEVICE SIZE TYPE <<< "$VOL_ENTRY"
    log ""
    log "  --- Migrating $VOL_ID ($DEVICE, $SIZE GB) ---"

    # 5a. Create snapshot
    log "  Creating snapshot of $VOL_ID..."
    SNAP_ID=$(aws ec2 create-snapshot \
        --region "$REGION" \
        --volume-id "$VOL_ID" \
        --description "EBS encryption migration - $VOL_ID - $TIMESTAMP" \
        --query 'SnapshotId' \
        --output text 2>>"$LOG_FILE")
    log "    Snapshot: $SNAP_ID"

    log "  Waiting for snapshot to complete (this may take a few minutes)..."
    aws ec2 wait snapshot-completed \
        --region "$REGION" \
        --snapshot-ids "$SNAP_ID" 2>>"$LOG_FILE"
    log "    ✓ Snapshot complete"

    # 5b. Copy snapshot with encryption
    log "  Copying snapshot with encryption enabled..."
    ENC_SNAP_ID=$(aws ec2 copy-snapshot \
        --region "$REGION" \
        --source-region "$REGION" \
        --source-snapshot-id "$SNAP_ID" \
        --encrypted \
        --description "Encrypted copy - $VOL_ID - $TIMESTAMP" \
        --query 'SnapshotId' \
        --output text 2>>"$LOG_FILE")
    log "    Encrypted snapshot: $ENC_SNAP_ID"

    log "  Waiting for encrypted snapshot to complete..."
    aws ec2 wait snapshot-completed \
        --region "$REGION" \
        --snapshot-ids "$ENC_SNAP_ID" 2>>"$LOG_FILE"
    log "    ✓ Encrypted snapshot complete"

    # 5c. Create encrypted volume from snapshot
    log "  Creating encrypted volume from snapshot..."
    NEW_VOL_ID=$(aws ec2 create-volume \
        --region "$REGION" \
        --availability-zone "$AZ" \
        --snapshot-id "$ENC_SNAP_ID" \
        --volume-type "$TYPE" \
        --encrypted \
        --query 'VolumeId' \
        --output text 2>>"$LOG_FILE")
    log "    New encrypted volume: $NEW_VOL_ID"

    log "  Waiting for volume to become available..."
    aws ec2 wait volume-available \
        --region "$REGION" \
        --volume-ids "$NEW_VOL_ID" 2>>"$LOG_FILE"
    log "    ✓ Volume available"

    # 5d. Detach old volume
    log "  Detaching old volume $VOL_ID from $DEVICE..."
    aws ec2 detach-volume \
        --region "$REGION" \
        --volume-id "$VOL_ID" 2>>"$LOG_FILE"
    aws ec2 wait volume-available \
        --region "$REGION" \
        --volume-ids "$VOL_ID" 2>>"$LOG_FILE"
    log "    ✓ Old volume detached"

    # 5e. Attach new encrypted volume
    log "  Attaching encrypted volume $NEW_VOL_ID to $DEVICE..."
    aws ec2 attach-volume \
        --region "$REGION" \
        --volume-id "$NEW_VOL_ID" \
        --instance-id "$INSTANCE_ID" \
        --device "$DEVICE" 2>>"$LOG_FILE"
    aws ec2 wait volume-in-use \
        --region "$REGION" \
        --volume-ids "$NEW_VOL_ID" 2>>"$LOG_FILE"
    log "    ✓ Encrypted volume attached"

    # 5f. Tag old volume and snapshots for cleanup
    aws ec2 create-tags \
        --region "$REGION" \
        --resources "$VOL_ID" \
        --tags "Key=Status,Value=replaced-by-encrypted-${NEW_VOL_ID}" \
               "Key=EncryptionMigration,Value=$TIMESTAMP" 2>>"$LOG_FILE"
    aws ec2 create-tags \
        --region "$REGION" \
        --resources "$SNAP_ID" "$ENC_SNAP_ID" "$NEW_VOL_ID" \
        --tags "Key=EncryptionMigration,Value=$TIMESTAMP" \
               "Key=Purpose,Value=EBS-encryption-CISO-6.1" 2>>"$LOG_FILE"

    log "  ✓ Volume $VOL_ID → $NEW_VOL_ID (encrypted) — migration complete"
done
log ""

# ── Step 6: Start instance and verify ─────────────────────
log "[6/6] Starting instance and verifying..."

aws ec2 start-instances \
    --region "$REGION" \
    --instance-ids "$INSTANCE_ID" >> "$LOG_FILE" 2>&1

log "  Waiting for instance to start..."
aws ec2 wait instance-running \
    --region "$REGION" \
    --instance-ids "$INSTANCE_ID" 2>>"$LOG_FILE"
log "  ✓ Instance running"

# Wait for SSH to come back
log "  Waiting for SSH to come back up..."
for i in $(seq 1 30); do
    if ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=no localhost 'echo ok' >/dev/null 2>&1; then
        break
    fi
    sleep 5
done

# Start the InsightHub service
log "  Starting InsightHub service..."
sudo systemctl start insighthub 2>>"$LOG_FILE" || true
sleep 5

# Verify all volumes are now encrypted
log ""
log "=== Final Verification ==="
ALL_ENCRYPTED=true
VOLUME_IDS=$(aws ec2 describe-instances \
    --region "$REGION" \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].BlockDeviceMappings[].Ebs.VolumeId' \
    --output text 2>>"$LOG_FILE")

for VOL_ID in $VOLUME_IDS; do
    ENCRYPTED=$(aws ec2 describe-volumes \
        --region "$REGION" \
        --volume-ids "$VOL_ID" \
        --query 'Volumes[0].Encrypted' \
        --output text 2>>"$LOG_FILE")
    DEVICE=$(aws ec2 describe-volumes \
        --region "$REGION" \
        --volume-ids "$VOL_ID" \
        --query 'Volumes[0].Attachments[0].Device' \
        --output text 2>>"$LOG_FILE")
    KMS_KEY=$(aws ec2 describe-volumes \
        --region "$REGION" \
        --volume-ids "$VOL_ID" \
        --query 'Volumes[0].KmsKeyId' \
        --output text 2>>"$LOG_FILE")

    if [ "$ENCRYPTED" = "True" ]; then
        log "  ✓ $VOL_ID ($DEVICE) — ENCRYPTED (KMS: ${KMS_KEY:-default})"
    else
        log "  ✗ $VOL_ID ($DEVICE) — NOT ENCRYPTED"
        ALL_ENCRYPTED=false
    fi
done

log ""
if [ "$ALL_ENCRYPTED" = true ]; then
    log "=== EBS Encryption Migration Complete ==="
    log "  All volumes encrypted at rest with AWS-managed KMS keys"
    log "  Default encryption enabled for region $REGION"
    log "  CISO Report §6.1: ✅ RESOLVED"
    log ""
    log "  Cleanup (optional — after confirming stability):"
    log "    Old volumes and snapshots tagged with EncryptionMigration=$TIMESTAMP"
    log "    Delete when confident: aws ec2 delete-volume / aws ec2 delete-snapshot"
else
    log "=== WARNING: Some volumes are still not encrypted ==="
    log "  Check $LOG_FILE for details"
    exit 1
fi
