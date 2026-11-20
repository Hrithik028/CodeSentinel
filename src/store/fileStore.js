import { promises as fs } from 'node:fs';
import path from 'node:path';

const EMPTY_STATE = () => ({ fingerprints: {}, scans: {}, config: {}, scanState: {} });

export class FileStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
  }

  async read() {
    try {
      return { ...EMPTY_STATE(), ...JSON.parse(await fs.readFile(this.filePath, 'utf8')) };
    } catch (error) {
      if (error.code === 'ENOENT') return EMPTY_STATE();
      throw error;
    }
  }

  update(mutator) {
    const run = this.queue.then(async () => {
      const state = await this.read();
      mutator(state);
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`);
      await fs.rename(temporary, this.filePath);
    });
    this.queue = run.catch(() => {});
    return run;
  }

  async getFingerprint(fingerprint) {
    return (await this.read()).fingerprints[fingerprint] ?? null;
  }

  setFingerprint(fingerprint, record) {
    return this.update((state) => { state.fingerprints[fingerprint] = { ...record, fingerprint }; });
  }

  async allFingerprintRecords() {
    return Object.values((await this.read()).fingerprints);
  }

  async getLatestScan(projectKey) {
    return (await this.read()).scans[projectKey] ?? null;
  }

  setLatestScan(projectKey, report) {
    return this.update((state) => { state.scans[projectKey] = report; });
  }

  async getConfig(key) {
    return (await this.read()).config[key] ?? null;
  }

  setConfig(key, value) {
    return this.update((state) => { state.config[key] = value; });
  }

  async getScanState(repoUrl) {
    return (await this.read()).scanState[repoUrl] ?? null;
  }

  setScanState(repoUrl, value) {
    return this.update((state) => {
      if (value === null) delete state.scanState[repoUrl];
      else state.scanState[repoUrl] = value;
    });
  }
}

export function createFileStore(filePath) {
  return new FileStore(filePath);
}
