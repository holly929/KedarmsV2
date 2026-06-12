#!/bin/bash

# Deployment Script for KedarmsV2
# This script commits changes and pushes to the main branch on GitHub,
# which triggers an automatic deployment on Vercel.

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting deployment process for KedarmsV2...${NC}"

# 1. Check if we are in a git repository
if [ ! -d .git ]; then
    echo -e "${RED}Error: Not a git repository.${NC}"
    exit 1
fi

# 2. Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "Current branch: ${BLUE}$CURRENT_BRANCH${NC}"

# 3. Add all changes
echo -e "${BLUE}Staging changes...${NC}"
git add .

# 4. Commit changes
echo -e "${BLUE}Committing changes...${NC}"
COMMIT_MSG="Update: Added Basic Levy to property forms, demand notices, and billing calculations"
git commit -m "$COMMIT_MSG"

# 5. Push to GitHub
echo -e "${BLUE}Pushing to GitHub (main branch)...${NC}"
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "Merging $CURRENT_BRANCH into main..."
    git checkout main
    git merge "$CURRENT_BRANCH"
fi

git push origin main

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Successfully pushed to GitHub!${NC}"
    echo -e "${GREEN}Vercel deployment has been triggered automatically.${NC}"
    echo -e "You can monitor the build at: https://vercel.com/dashboard"
else
    echo -e "${RED}Failed to push to GitHub. Please check your internet connection or permissions.${NC}"
    exit 1
fi

echo -e "${BLUE}Deployment process complete.${NC}"
