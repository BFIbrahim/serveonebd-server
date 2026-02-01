const fs = require('fs');

const key = fs.readFileSync('./firebase-admin-key.json', 'utf8');
const base64 = Buffer.from(key).toString('base64');

// IMPORTANT: remove any accidental newlines
console.log(base64.replace(/\r?\n|\r/g, ''));
