import * as fs from 'fs';
import * as path from 'path';
import { KNOWN_BAD_VERSIONS, getAllKnownBadIOCDeps } from './known-bad';
import { Alert, AlertType, DetectorResult } from '../types';

interface LockfileMatch {
  file: string;
  packageName: string;
  version: string;
  reason: string;
}

export class LockfileScanner {
  private static readonly LOCKFILES = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
  ];

  static async scanDirectory(dir: string): Promise<DetectorResult> {
    const alerts: Alert[] = [];

    for (const filename of this.LOCKFILES) {
      const lockfilePath = path.join(dir, filename);
      if (!fs.existsSync(lockfilePath)) continue;

      const matches = await this.scanLockfile(lockfilePath);
      for (const match of matches) {
        alerts.push({
          type: AlertType.LOCKFILE_MATCH,
          severity: 'high',
          message: match.reason,
          details: {
            file: match.file,
            package: match.packageName,
            version: match.version,
          },
        });
      }
    }

    return { detected: alerts.length > 0, alerts };
  }

  static async scanLockfile(lockfilePath: string): Promise<LockfileMatch[]> {
    const filename = path.basename(lockfilePath);
    let content: string;
    try {
      content = await fs.promises.readFile(lockfilePath, 'utf8');
    } catch {
      return [];
    }

    if (filename === 'package-lock.json') return this.scanPackageLock(lockfilePath, content);
    if (filename === 'yarn.lock') return this.scanYarnLock(lockfilePath, content);
    if (filename === 'pnpm-lock.yaml') return this.scanPnpmLock(lockfilePath, content);
    return [];
  }

  // ─── package-lock.json ────────────────────────────────────────────────────

  private static scanPackageLock(filePath: string, content: string): LockfileMatch[] {
    const matches: LockfileMatch[] = [];
    const iocDeps = getAllKnownBadIOCDeps();

    let lock: any;
    try {
      lock = JSON.parse(content);
    } catch {
      return [];
    }

    // v2/v3 lockfiles use `packages`; v1 uses `dependencies`
    const packages: Record<string, any> = lock.packages ?? lock.dependencies ?? {};

    for (const [key, value] of Object.entries(packages)) {
      if (!value || typeof value !== 'object') continue;

      // v2/v3: key is "node_modules/foo" or "node_modules/foo/node_modules/bar"
      const packageName = key.replace(/^node_modules\//, '').replace(/\/node_modules\//g, '/');
      const version: string = value.version ?? '';
      if (!version) continue;

      const knownBad = KNOWN_BAD_VERSIONS.find(
        e => e.package === packageName && e.versions.includes(version)
      );
      if (knownBad) {
        matches.push({
          file: filePath,
          packageName,
          version,
          reason:
            `Known-compromised version ${packageName}@${version} found in ${path.basename(filePath)} ` +
            `(${knownBad.incident})`,
        });
      }

      if (iocDeps.includes(packageName)) {
        matches.push({
          file: filePath,
          packageName,
          version,
          reason:
            `IOC dependency ${packageName}@${version} found in ${path.basename(filePath)} ` +
            `— associated with a known supply chain incident`,
        });
      }
    }

    return matches;
  }

  // ─── yarn.lock ────────────────────────────────────────────────────────────

  private static scanYarnLock(filePath: string, content: string): LockfileMatch[] {
    const matches: LockfileMatch[] = [];
    const iocDeps = getAllKnownBadIOCDeps();

    // Matches blocks like:
    //   "axios@^1.14.1", "axios@~1.14.0":
    //     version "1.14.1"
    // or (yarn berry):
    //   axios@npm:^1.14.1:
    //     version: 1.14.1
    const blockRegex =
      /^(?:"?([^@\s"]+)@[^":\n]+"?\s*(?:,\s*"?[^@\s"]+@[^":\n]+"?)*):\s*\n(?:[ \t]+.*\n)*?[ \t]+version[: ]+"?(\d[\d.a-zA-Z\-+]*)"?/gm;

    let m: RegExpExecArray | null;
    while ((m = blockRegex.exec(content)) !== null) {
      const packageName = m[1].replace(/^[^:]+:/, ''); // strip protocol (npm:, patch:, …)
      const version = m[2];

      const knownBad = KNOWN_BAD_VERSIONS.find(
        e => e.package === packageName && e.versions.includes(version)
      );
      if (knownBad) {
        matches.push({
          file: filePath,
          packageName,
          version,
          reason:
            `Known-compromised version ${packageName}@${version} found in ${path.basename(filePath)} ` +
            `(${knownBad.incident})`,
        });
      }

      if (iocDeps.includes(packageName)) {
        matches.push({
          file: filePath,
          packageName,
          version,
          reason:
            `IOC dependency ${packageName}@${version} found in ${path.basename(filePath)} ` +
            `— associated with a known supply chain incident`,
        });
      }
    }

    return matches;
  }

  // ─── pnpm-lock.yaml ───────────────────────────────────────────────────────

  private static scanPnpmLock(filePath: string, content: string): LockfileMatch[] {
    const matches: LockfileMatch[] = [];
    const iocDeps = getAllKnownBadIOCDeps();

    // pnpm v6/v7: "  /axios/1.14.1:"  or  "  /axios@1.14.1:"
    // pnpm v8+:   "  axios@1.14.1:"
    const packageRegex =
      /^\s+\/?([a-zA-Z0-9@._\-\/]+?)[@\/](\d+\.\d+\.\d+[^\s:]*):/gm;

    let m: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((m = packageRegex.exec(content)) !== null) {
      const packageName = m[1].replace(/^\//, '');
      const version = m[2];
      const key = `${packageName}@${version}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const knownBad = KNOWN_BAD_VERSIONS.find(
        e => e.package === packageName && e.versions.includes(version)
      );
      if (knownBad) {
        matches.push({
          file: filePath,
          packageName,
          version,
          reason:
            `Known-compromised version ${packageName}@${version} found in ${path.basename(filePath)} ` +
            `(${knownBad.incident})`,
        });
      }

      if (iocDeps.includes(packageName)) {
        matches.push({
          file: filePath,
          packageName,
          version,
          reason:
            `IOC dependency ${packageName}@${version} found in ${path.basename(filePath)} ` +
            `— associated with a known supply chain incident`,
        });
      }
    }

    return matches;
  }
}
