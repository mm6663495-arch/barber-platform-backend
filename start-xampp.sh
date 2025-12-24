#!/bin/bash

echo "Starting Barber Platform Backend on XAMPP..."
echo

echo "1. Installing dependencies..."
npm install

echo
echo "2. Setting up database..."
npx prisma migrate dev --name init

echo
echo "3. Generating Prisma client..."
npx prisma generate

echo
echo "4. Starting development server..."
npm run start:dev

