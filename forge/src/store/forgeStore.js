import { kvs, WhereConditions } from '@forge/kvs';

const PAGE_SIZE = 100;

const keys = {
  fingerprint: (fingerprint) => `fp:${fingerprint}`,
  latestScan: (projectKey) => `scan:${projectKey}:latest`,
  config: (key) => `config:${key}`,
  scanState: (repoUrl) => `scanstate:${repoUrl}`,
  pat: (repoUrl) => `pat:${repoUrl}`
};

// Forge KVS keys allow only [A-Za-z0-9:._\s-#]; repo URLs contain "/" so they are encoded.
// "#" is the escape character, so it is escaped too, with fixed-width hex, keeping the mapping injective.
export function safeKey(key) {
  return key.replace(/[^A-Za-z0-9:._-]/g, (char) => `#${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export class ForgeStore {
  constructor(client = kvs) {
    this.kvs = client;
  }

  async get(key) {
    return (await this.kvs.get(safeKey(key))) ?? null;
  }

  async set(key, value) {
    if (value === null || value === undefined) await this.kvs.delete(safeKey(key));
    else await this.kvs.set(safeKey(key), value);
  }

  getFingerprint(fingerprint) {
    return this.get(keys.fingerprint(fingerprint));
  }

  setFingerprint(fingerprint, record) {
    return this.set(keys.fingerprint(fingerprint), { fingerprint, ...record });
  }

  async allFingerprintRecords() {
    const records = [];
    let cursor;
    do {
      let query = this.kvs.query().where('key', WhereConditions.beginsWith('fp:')).limit(PAGE_SIZE);
      if (cursor) query = query.cursor(cursor);
      const page = await query.getMany();
      records.push(...page.results.map((result) => result.value));
      cursor = page.nextCursor;
    } while (cursor);
    return records;
  }

  getLatestScan(projectKey) {
    return this.get(keys.latestScan(projectKey));
  }

  setLatestScan(projectKey, scan) {
    return this.set(keys.latestScan(projectKey), scan);
  }

  getConfig(key) {
    return this.get(keys.config(key));
  }

  setConfig(key, value) {
    return this.set(keys.config(key), value);
  }

  getScanState(repoUrl) {
    return this.get(keys.scanState(repoUrl));
  }

  setScanState(repoUrl, value) {
    return this.set(keys.scanState(repoUrl), value);
  }

  async getPat(repoUrl) {
    return (await this.kvs.getSecret(safeKey(keys.pat(repoUrl)))) ?? null;
  }

  async setPat(repoUrl, pat) {
    if (pat) await this.kvs.setSecret(safeKey(keys.pat(repoUrl)), pat);
    else await this.kvs.deleteSecret(safeKey(keys.pat(repoUrl)));
  }
}

export function createForgeStore(client) {
  return new ForgeStore(client);
}
