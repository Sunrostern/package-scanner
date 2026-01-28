import { NetworkAccessDetector } from '../network-access';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('NetworkAccessDetector', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should detect http module usage', async () => {
    const code = `
      const http = require('http');
      http.createServer((req, res) => {
        res.end('Hello');
      });
    `;

    fs.writeFileSync(path.join(testDir, 'server.js'), code);

    const result = await NetworkAccessDetector.detect(testDir);

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]?.type).toBe('network_access');
    expect(result.alerts[0]?.severity).toBe('medium');
    expect(result.alerts[0]?.details?.patterns).toContain('Module: http');
  });

  it('should detect fetch API', async () => {
    const code = `
      async function getData() {
        const response = await fetch('https://api.example.com');
        return response.json();
      }
    `;

    fs.writeFileSync(path.join(testDir, 'api.js'), code);

    const result = await NetworkAccessDetector.detect(testDir);

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]?.details?.patterns).toContain('Global: fetch');
  });

  it('should detect axios usage', async () => {
    const code = `
      import axios from 'axios';
      axios.get('https://api.example.com');
    `;

    fs.writeFileSync(path.join(testDir, 'client.ts'), code);

    const result = await NetworkAccessDetector.detect(testDir);

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]?.details?.patterns).toContain('Module: axios');
  });

  it('should not alert on packages without network access', async () => {
    const code = `
      function add(a, b) {
        return a + b;
      }
      module.exports = { add };
    `;

    fs.writeFileSync(path.join(testDir, 'math.js'), code);

    const result = await NetworkAccessDetector.detect(testDir);

    expect(result.alerts).toHaveLength(0);
  });

  it('should handle empty directories', async () => {
    const result = await NetworkAccessDetector.detect(testDir);
    expect(result.alerts).toHaveLength(0);
  });

  it('should detect multiple network patterns', async () => {
    const code = `
      const http = require('http');
      const https = require('https');
      const net = require('net');
      
      fetch('https://example.com');
      new WebSocket('ws://example.com');
    `;

    fs.writeFileSync(path.join(testDir, 'network.js'), code);

    const result = await NetworkAccessDetector.detect(testDir);

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]?.details?.patterns?.length || 0).toBeGreaterThan(3);
  });
});
