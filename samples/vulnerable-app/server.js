// This intentionally vulnerable file exists only to demonstrate CodeSentinel.
import { exec } from 'node:child_process';
import crypto from 'node:crypto';

const apiKey = 'demo_sk_never_use_this_key';
const debug = true;

export function searchUsers(database, name) {
  return database.query(`SELECT * FROM users WHERE name = '${name}'`);
}

export function pingHost(host) {
  exec(`ping ${host}`, () => {});
}

export function oldPasswordHash(password) {
  return crypto.createHash('md5').update(password).digest('hex');
}

console.log('token', apiKey);
