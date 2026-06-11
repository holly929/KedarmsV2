#!/bin/bash
set -e

# Configuration
SOURCE_BRANCH="Kedarmsv2"
TARGET_BRANCH="main"

echo "Starting merge from $SOURCE_BRANCH to $TARGET_BRANCH..."

# Ensure we are in the repo directory
cd "$(dirname "$0")"

# Fetch latest changes
git fetch origin

# Switch to target branch
echo "Switching to $TARGET_BRANCH..."
git checkout $TARGET_BRANCH || git checkout -b $TARGET_BRANCH origin/$TARGET_BRANCH

# Pull latest target branch
git pull origin $TARGET_BRANCH

# Merge source branch into target
echo "Merging $SOURCE_BRANCH into $TARGET_BRANCH..."
git merge origin/$SOURCE_BRANCH -m "Merge branch '$SOURCE_BRANCH' into $TARGET_BRANCH"

# Push changes to origin
echo "Pushing changes to origin/$TARGET_BRANCH..."
git push origin $TARGET_BRANCH

echo "Deployment complete! $SOURCE_BRANCH has been merged into $TARGET_BRANCH."
