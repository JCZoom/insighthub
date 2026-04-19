#!/bin/bash
# Check EBS volume encryption status for the InsightHub EC2 instance
#
# Usage: ./scripts/check-ebs-encryption.sh
#
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - Permissions: ec2:DescribeVolumes, ec2:DescribeInstances
#
# This script checks if the EBS volumes attached to the InsightHub instance
# are encrypted at rest (CISO Report §6.1, Risk #4).
#
set -euo pipefail

# Instance identification — update if the instance changes
# Uses the public DNS from ec2-deploy.sh
INSTANCE_FILTER="Name=tag:Name,Values=*insighthub*,*InsightHub*,*autoqa*"
REGION="${AWS_DEFAULT_REGION:-us-east-2}"

echo "=== EBS Encryption Check ==="
echo "  Region: $REGION"
echo ""

# Try to find the instance by name tag first, fall back to running instances
INSTANCE_ID=$(aws ec2 describe-instances \
    --region "$REGION" \
    --filters "$INSTANCE_FILTER" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text 2>/dev/null || echo "None")

if [ "$INSTANCE_ID" = "None" ] || [ -z "$INSTANCE_ID" ]; then
    echo "Could not find instance by tag. Listing all running instances:"
    aws ec2 describe-instances \
        --region "$REGION" \
        --filters "Name=instance-state-name,Values=running" \
        --query 'Reservations[].Instances[].[InstanceId, Tags[?Key==`Name`].Value | [0], PublicDnsName]' \
        --output table
    echo ""
    echo "Set INSTANCE_ID manually and re-run, or update the INSTANCE_FILTER in this script."
    exit 1
fi

echo "Instance: $INSTANCE_ID"
echo ""

# Get all attached volumes
VOLUMES=$(aws ec2 describe-instances \
    --region "$REGION" \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].BlockDeviceMappings[].Ebs.VolumeId' \
    --output text)

if [ -z "$VOLUMES" ]; then
    echo "ERROR: No EBS volumes found for instance $INSTANCE_ID"
    exit 1
fi

ALL_ENCRYPTED=true
echo "Volume Encryption Status:"
echo "─────────────────────────────────────────────────────"

for VOL_ID in $VOLUMES; do
    VOL_INFO=$(aws ec2 describe-volumes \
        --region "$REGION" \
        --volume-ids "$VOL_ID" \
        --query 'Volumes[0].[VolumeId, Encrypted, Size, VolumeType, State]' \
        --output text)

    ENCRYPTED=$(echo "$VOL_INFO" | awk '{print $2}')
    SIZE=$(echo "$VOL_INFO" | awk '{print $3}')
    TYPE=$(echo "$VOL_INFO" | awk '{print $4}')

    if [ "$ENCRYPTED" = "True" ]; then
        STATUS="✅ ENCRYPTED"
    else
        STATUS="❌ NOT ENCRYPTED"
        ALL_ENCRYPTED=false
    fi

    printf "  %-21s  %s  (%s GB, %s)\n" "$VOL_ID" "$STATUS" "$SIZE" "$TYPE"
done

echo "─────────────────────────────────────────────────────"
echo ""

# Check default encryption setting for the region
DEFAULT_ENC=$(aws ec2 get-ebs-encryption-by-default \
    --region "$REGION" \
    --query 'EbsEncryptionByDefault' \
    --output text 2>/dev/null || echo "Unknown")

echo "Default EBS encryption for $REGION: $DEFAULT_ENC"
echo ""

if [ "$ALL_ENCRYPTED" = true ]; then
    echo "✅ All EBS volumes are encrypted at rest."
    echo "   CISO Report §6.1 / Risk #4: RESOLVED"
else
    echo "❌ One or more EBS volumes are NOT encrypted."
    echo ""
    echo "Remediation steps:"
    echo "  1. Enable default EBS encryption for the region:"
    echo "     aws ec2 enable-ebs-encryption-by-default --region $REGION"
    echo ""
    echo "  2. For existing unencrypted volumes, create encrypted copies:"
    echo "     a. Stop the instance"
    echo "     b. Create a snapshot of the unencrypted volume"
    echo "     c. Copy the snapshot with encryption enabled"
    echo "     d. Create a new volume from the encrypted snapshot"
    echo "     e. Detach the old volume and attach the new encrypted one"
    echo "     f. Start the instance"
    echo ""
    echo "  See: https://docs.aws.amazon.com/ebs/latest/userguide/EBSEncryption.html"
    exit 2
fi
