import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export class LocalCache {
  constructor(private readonly baseDir: string) {}

  async init(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
  }

  filePath(name: string): string {
    return resolve(this.baseDir, name);
  }

  async readText(name: string): Promise<string | null> {
    try {
      return await readFile(this.filePath(name), 'utf8');
    } catch {
      return null;
    }
  }

  async writeText(name: string, value: string): Promise<void> {
    const path = this.filePath(name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, value, 'utf8');
  }
}
