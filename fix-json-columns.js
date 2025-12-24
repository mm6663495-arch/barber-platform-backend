/* eslint-disable no-console */
// Node script to sanitize and enforce JSON columns using Prisma
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function execSafe(query) {
  try {
    await prisma.$executeRawUnsafe(query);
    return true;
  } catch (e) {
    console.warn('⚠️  Skipped:', query.split('\n')[0], '-', e?.meta?.message || e.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Fixing JSON columns...');

  // Clean invalid JSON values
  await execSafe(`UPDATE Salon SET images='[]' WHERE images IS NULL OR JSON_VALID(images)=0;`);
  await execSafe(`UPDATE Salon SET services='[]' WHERE services IS NULL OR JSON_VALID(services)=0;`);
  await execSafe(`UPDATE Salon SET workingHours='{}' WHERE workingHours IS NULL OR JSON_VALID(workingHours)=0;`);
  await execSafe(`UPDATE Package SET images='[]' WHERE images IS NULL OR JSON_VALID(images)=0;`);
  await execSafe(`UPDATE Package SET services='[]' WHERE services IS NULL OR JSON_VALID(services)=0;`);

  // Optional: other tables
  try {
    await execSafe(`UPDATE User SET notificationSettings='{}' WHERE notificationSettings IS NULL OR JSON_VALID(notificationSettings)=0;`);
  } catch (_) {}
  try {
    await execSafe(`UPDATE Notification SET data='{}' WHERE data IS NULL OR JSON_VALID(data)=0;`);
  } catch (_) {}
  try {
    await execSafe(`UPDATE AuditLog SET details='{}' WHERE details IS NULL OR JSON_VALID(details)=0;`);
  } catch (_) {}

  console.log('✅ JSON cleanup executed.');
  console.log('ℹ️ If columns are TEXT, run SQL in fix-json-columns.sql to MODIFY to JSON types.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });


