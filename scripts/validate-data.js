const { records, sources } = require('../api/_lib/data');

try {
  const titleRecords = records();
  const sourceRecords = sources();
  console.log(`Validated ${titleRecords.length} mining records and ${sourceRecords.length} sources.`);
} catch (error) {
  console.error(`Data validation failed: ${error.message}`);
  process.exitCode = 1;
}
