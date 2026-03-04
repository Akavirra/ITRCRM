
const { parseDatabaseDate, formatTimeKyiv } = require('./src/lib/date-utils');

// Test case 1: SQLite format
const testDate1 = '2026-03-04 10:00:00';
const parsed1 = parseDatabaseDate(testDate1);
console.log('Test 1 - SQLite format');
console.log('Input:', testDate1);
console.log('Parsed Date:', parsed1);
console.log('Formatted Time:', formatTimeKyiv(testDate1));

// Test case 2: ISO format with Z
const testDate2 = '2026-03-04T10:00:00Z';
const parsed2 = parseDatabaseDate(testDate2);
console.log('\nTest 2 - ISO format with Z');
console.log('Input:', testDate2);
console.log('Parsed Date:', parsed2);
console.log('Formatted Time:', formatTimeKyiv(testDate2));

// Test case 3: PostgreSQL format
const testDate3 = '2026-03-04 10:00:00+02';
const parsed3 = parseDatabaseDate(testDate3);
console.log('\nTest 3 - PostgreSQL format');
console.log('Input:', testDate3);
console.log('Parsed Date:', parsed3);
console.log('Formatted Time:', formatTimeKyiv(testDate3));
