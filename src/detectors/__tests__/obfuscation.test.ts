import { ObfuscationDetector } from '../obfuscation';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ObfuscationDetector', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should detect obfuscated code with high entropy', async () => {
    // Generate highly random/obfuscated content with high entropy
    const randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let obfuscatedCode = '';
    
    // Create random strings that will have high entropy
    for (let i = 0; i < 50; i++) {
      let randomStr = '';
      for (let j = 0; j < 100; j++) {
        randomStr += randomChars[Math.floor(Math.random() * randomChars.length)];
      }
      obfuscatedCode += `var _0x${i}="${randomStr}";\n`;
    }
    
    obfuscatedCode += 'eval(atob("bWFsaWNpb3VzIGNvZGU="));\n';

    fs.writeFileSync(path.join(testDir, 'obfuscated.js'), obfuscatedCode);

    const result = await ObfuscationDetector.detect(testDir);

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]?.type).toBe('obfuscated_code');
    expect(result.alerts[0]?.severity).toBe('high');
  });

  it('should not alert on normal code', async () => {
    const normalCode = `
      function calculateSum(numbers) {
        return numbers.reduce((sum, num) => sum + num, 0);
      }
      
      module.exports = { calculateSum };
    `;

    fs.writeFileSync(path.join(testDir, 'normal.js'), normalCode);

    const result = await ObfuscationDetector.detect(testDir);

    expect(result.alerts).toHaveLength(0);
  });

  it('should skip small files', async () => {
    const smallCode = 'const x = 1;';

    fs.writeFileSync(path.join(testDir, 'small.js'), smallCode);

    const result = await ObfuscationDetector.detect(testDir);

    expect(result.alerts).toHaveLength(0);
  });
});
