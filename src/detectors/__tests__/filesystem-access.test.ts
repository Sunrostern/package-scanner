import { FilesystemAccessDetector } from '../filesystem-access';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FilesystemAccessDetector', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should detect fs module usage', async () => {
    const code = `
      const fs = require('fs');
      fs.writeFileSync('malicious.txt', 'data');
    `;

    fs.writeFileSync(path.join(testDir, 'file.js'), code);

    const result = await FilesystemAccessDetector.detect(testDir);

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]?.type).toBe('filesystem_access');
    expect(result.alerts[0]?.severity).toBe('medium');
  });

  it('should detect dangerous fs operations', async () => {
    const code = `
      import fs from 'fs';
      fs.unlinkSync('/important/file');
      fs.rmdirSync('/important/dir');
    `;

    fs.writeFileSync(path.join(testDir, 'dangerous.js'), code);

    const result = await FilesystemAccessDetector.detect(testDir);

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]?.details?.patterns?.length).toBeGreaterThan(0);
  });

  it('should not alert on packages without fs access', async () => {
    const code = `
      function add(a, b) {
        return a + b;
      }
    `;

    fs.writeFileSync(path.join(testDir, 'clean.js'), code);

    const result = await FilesystemAccessDetector.detect(testDir);

    expect(result.alerts).toHaveLength(0);
  });
});
