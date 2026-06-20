#!/bin/bash
set -e

echo "=== INITIALIZING XAVVYSUITE ARCHITECTURE DEPLOYMENT ==="

cd backend
echo "Initializing Cloudflare D1 Database Matrix..."
npx wrangler d1 create xavvysuite-db || true

echo "Applying Schema migrations to Remote Edge Node..."
npx wrangler d1 execute xavvysuite-db --remote --file=./schema.sql

echo "Publishing Edge Core API Worker..."
npx wrangler deploy

cd ../frontend
echo "Building Production Static Asset Clusters..."
npm install
npm run build

echo "Deploying Static Clusters into Cloudflare Pages Web Domains..."
npx wrangler pages deploy dist --project-name=xavvysuite-app

echo "=== ROUTING CONFIGURATION INSTRUCTIONS ==="
echo "Please tie your Cloudflare Pages domains manually using Subdomains routing configs inside your Cloudflare Dashboard:"
echo "1. Map hr.xavvy.uk to your project build production output branch."
echo "2. Map timesheet.xavvy.uk to your project build production output branch."
