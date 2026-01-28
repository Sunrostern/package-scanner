# NPM Malware Scanner

[![npm version](https://badge.fury.io/js/npm-malware-scanner.svg)](https://www.npmjs.com/package/npm-malware-scanner)
[![npm downloads](https://img.shields.io/npm/dm/npm-malware-scanner.svg)](https://www.npmjs.com/package/npm-malware-scanner)
[![license](https://img.shields.io/npm/l/npm-malware-scanner.svg)](https://github.com/socket-security/npm-scanner/blob/main/LICENSE)

Real-time malware scanner for npm packages. Detects install scripts, network access, and typosquatting attacks.

## Installation

```bash
# Global installation
npm install -g npm-malware-scanner

# Or use directly with npx
npx npm-malware-scanner express 4.18.2
```

## Usage

### Scan a Package

```bash
npm-scanner <package-name> <version>

# Examples
npm-scanner express 4.18.2
npm-scanner axios 1.6.0
```

### Live Monitoring

Monitor the npm registry feed in real-time:

```bash
npm-scanner --live
```

### CI/CD Integration

The scanner automatically detects CI/CD environments and adapts output format.

**GitHub Actions:**
```yaml
- name: Security Scan
  run: npm-scanner express 4.18.2
```

**Other CI Systems:**
```bash
CI=true npm-scanner express 4.18.2
```

See [CI-CD-INTEGRATION.md](./CI-CD-INTEGRATION.md) for detailed integration guides.

## Detection Capabilities

### Install Scripts
Identifies packages with lifecycle scripts that execute arbitrary code:
- \`preinstall\`, \`install\`, \`postinstall\`
- \`preuninstall\`, \`uninstall\`, \`postuninstall\`

**Severity:** High

### Network Access
Detects packages making network requests:
- Node.js modules: \`http\`, \`https\`, \`net\`, \`dgram\`, \`dns\`
- Browser APIs: \`fetch\`, \`XMLHttpRequest\`, \`WebSocket\`, \`EventSource\`
- Popular libraries: \`axios\`, \`node-fetch\`, \`got\`, \`superagent\`, \`request\`

**Severity:** Medium

### Typosquatting
Identifies packages with names similar to popular packages using Levenshtein distance.

**Severity:** High

## Architecture

```
src/
├── cli.ts                    # CLI entry point
├── scanner.ts                # Scan orchestration
├── types.ts                  # TypeScript interfaces
├── detectors/
│   ├── install-scripts.ts    # Lifecycle script detection
│   ├── network-access.ts     # Network access detection (AST + regex)
│   └── typosquat.ts          # Typosquat detection
├── npm/
│   ├── registry.ts           # Package fetching & extraction
│   └── feed.ts               # Live feed monitoring
└── utils/
    ├── logger.ts             # Output formatting
    └── environment.ts        # CI/CD detection
```

## Design Decisions

### Static Analysis Only
**Choice:** Analyze code without execution  
**Rationale:** Safe, fast (~500ms per package), effective for most threats  
**Tradeoff:** Cannot detect runtime behavior or heavily obfuscated code

### Hybrid Detection (AST + Regex)
**Choice:** Combine AST parsing with regex patterns  
**Rationale:** AST for accuracy, regex for obfuscated/dynamic code  
**Tradeoff:** Slightly slower but more comprehensive

### Popular Packages for Typosquat
**Choice:** Compare only against top npm packages  
**Rationale:** Fast, practical, low false positives  
**Tradeoff:** Misses typosquats of less popular packages

## Extending the Scanner

### Adding a New Detector

Create a detector file:

```typescript
// src/detectors/my-detector.ts
import { Alert, DetectorResult } from '../types';

export class MyDetector {
  static async detect(packagePath: string): Promise<DetectorResult> {
    const alerts: Alert[] = [];
    
    // Your detection logic
    
    return { alerts };
  }
}
```

Register in \`src/scanner.ts\`:

```typescript
import { MyDetector } from './detectors/my-detector';

const [installScriptResult, networkAccessResult, typosquatResult, myResult] = 
  await Promise.all([
    InstallScriptDetector.detect(packageInfo.extractedPath),
    NetworkAccessDetector.detect(packageInfo.extractedPath),
    TyposquatDetector.detect(packageName),
    MyDetector.detect(packageInfo.extractedPath), // Add here
  ]);

alerts.push(...myResult.alerts);
```

### Development

```bash
# Clone and setup
git clone https://github.com/socket-security/npm-scanner
cd npm-scanner
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Test with coverage
pnpm test:coverage

# Test a package
pnpm start express 4.18.2

# Test in CI mode
CI=true pnpm start express 4.18.2
```

### Testing

The project includes comprehensive unit tests for all detectors:

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

**Test Coverage:**
- Install script detection
- Network access detection (http, fetch, axios, etc.)
- Typosquat detection (Levenshtein distance)
- Edge cases and error handling

## Known Limitations

- **Static analysis only** - Cannot detect runtime behavior
- **No dependency scanning** - Only scans the target package
- **Obfuscation** - Heavily obfuscated code may evade detection
- **False positives** - Legitimate packages may trigger alerts (e.g., HTTP clients)

## Performance

- Single package scan: 500ms - 2s
- Network detection: 100-500ms
- Typosquat check: ~50ms
- Live mode throughput: 1-2 packages/second

## Contributing

Contributions welcome! Areas of interest:
- New detectors (shell access, crypto mining, data exfiltration)
- Performance improvements
- Better obfuscation detection
- Additional CI/CD integrations

## License

MIT
