import { InstallScriptDetector } from '../install-scripts';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('InstallScriptDetector', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should detect install scripts', async () => {
    const packageJson = {
      name: 'test-package',
      version: '1.0.0',
      scripts: {
        install: 'node install.js',
        postinstall: 'echo "installed"'
      }
    };

    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    const result = await InstallScriptDetector.detect(testDir);

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].type).toBe('install_script');
    expect(result.alerts[0].severity).toBe('high');
    expect(result.alerts[0]?.details?.scripts).toEqual({
      install: 'node install.js',
      postinstall: 'echo "installed"'
    });
  });

  it('should not alert on safe scripts', async () => {
    const packageJson = {
      name: 'test-package',
      version: '1.0.0',
      scripts: {
        test: 'jest',
        build: 'tsc',
        start: 'node index.js'
      }
    };

    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    const result = await InstallScriptDetector.detect(testDir);

    expect(result.alerts).toHaveLength(0);
  });

  it('should handle missing package.json', async () => {
    const result = await InstallScriptDetector.detect(testDir);
    expect(result.alerts).toHaveLength(0);
  });

  it('should detect all risky lifecycle scripts', async () => {
    const packageJson = {
      name: 'test-package',
      version: '1.0.0',
      scripts: {
        preinstall: 'echo pre',
        install: 'echo install',
        postinstall: 'echo post',
        preuninstall: 'echo preun',
        uninstall: 'echo un',
        postuninstall: 'echo postun'
      }
    };

    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    const result = await InstallScriptDetector.detect(testDir);

    expect(result.alerts).toHaveLength(1);
    expect(Object.keys(result.alerts[0]?.details?.scripts || {})).toHaveLength(6);
  });
});
