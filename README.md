# NPM Malware Scanner

[![npm version](https://badge.fury.io/js/npm-malware-scanner.svg)](https://www.npmjs.com/package/npm-malware-scanner)
[![npm downloads](https://img.shields.io/npm/dm/npm-malware-scanner.svg)](https://www.npmjs.com/package/npm-malware-scanner)
[![license](https://img.shields.io/npm/l/npm-malware-scanner.svg)](https://github.com/Sunrostern/npm-scanner/blob/main/LICENSE)

Real-time malware scanner for npm packages. Detects install scripts, shell access, obfuscated code, network access, filesystem access, typosquatting attacks, and known-compromised supply chain versions.

### Key Resources Used

**Supply Chain Security:**
- [npm Security Best Practices](https://docs.npmjs.com/packages-and-modules/securing-your-code) - Understanding npm security model
- [OWASP Top 10 for CI/CD](https://owasp.org/www-project-top-10-ci-cd-security-risks/) - CI/CD security risks

**Static Analysis Techniques:**
- [Babel Parser Documentation](https://babeljs.io/docs/babel-parser) - AST parsing for JavaScript/TypeScript
- [ESLint Source Code](https://github.com/eslint/eslint) - Pattern matching and code analysis techniques
- [Shannon Entropy](https://en.wikipedia.org/wiki/Entropy_(information_theory)) - Obfuscation detection using information theory

**Typosquatting Research:**
- [Levenshtein Distance Algorithm](https://en.wikipedia.org/wiki/Levenshtein_distance) - String similarity measurement
- [Typosquatting on PyPI](https://arxiv.org/abs/2003.03471) - Academic research on package name attacks
- [npm Typosquatting Attacks](https://blog.sonatype.com/damaging-linux-mac-malware-bundled-within-browserify-npm-brandjack-attempt) - Real-world examples

**npm Registry APIs:**
- [npm Registry API](https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md) - Package metadata and download
- [CouchDB Changes Feed](https://docs.couchdb.org/en/stable/api/database/changes.html) - Real-time monitoring

**Notable CVEs & Attacks:**
- [CVE-2021-44906](https://nvd.nist.gov/vuln/detail/CVE-2021-44906) - Minimist prototype pollution
- [event-stream incident](https://blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident) - Malicious dependency injection
- [ua-parser-js attack](https://github.com/advisories/GHSA-pjwm-rvh2-c87w) - Cryptocurrency miner in popular package

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

### Lockfile Scan

Scan `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml` for known-compromised versions and IOC dependencies without hitting the registry:

```bash
# Scan lockfiles in the current directory
npm-scanner --lockfile

# Scan lockfiles in a specific directory
npm-scanner --lockfile ./path/to/project
```

This mode is useful when a version has already been unpublished from npm (as happened with `axios@1.14.1` and `axios@0.30.4`) — registry-based scanning returns 404, but lockfile evidence of prior installation remains.

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
- `preinstall`, `install`, `postinstall`
- `preuninstall`, `uninstall`, `postuninstall`

**Severity:** High

### Shell Access
Detects use of `child_process` APIs that can run system commands:
- `exec`, `execSync`, `spawn`, `spawnSync`, `execFile`
- Shell command strings passed to process execution

**Severity:** High

### Obfuscated Code
Calculates Shannon entropy on each source file. Files with entropy above the threshold are flagged as likely obfuscated or encoded payloads.

**Severity:** High

### Typosquatting
Compares the package name against the top npm packages using Levenshtein distance. Close matches are flagged as potential brand-jacking attempts.

**Severity:** High (very close match) / Medium

### Network Access
Detects packages making network requests:
- Node.js modules: `http`, `https`, `net`, `dgram`, `dns`
- Browser APIs: `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`
- Popular libraries: `axios`, `node-fetch`, `got`, `superagent`, `request`

**Severity:** Medium

### Filesystem Access
Detects use of `fs` module operations that read, write, or modify files on disk:
- `writeFile`, `appendFile`, `unlink`, `rename`, `chmod`, `chown`
- Recursive directory operations (`rmdir`, `rm`)

**Severity:** Medium

### Known Compromised Version
Checks the requested version against a built-in database of known supply chain incidents. When a version matches and has been unpublished from npm (returning 404), the scanner reports it as a confirmed IOC rather than a generic fetch failure, and automatically runs a lockfile scan.

**Severity:** High

### Lockfile Match
When scanning lockfiles (`--lockfile` mode or triggered automatically after a known-compromised 404), every resolved dependency is checked against the known-bad version list and IOC dependency list (e.g. `plain-crypto-js` from the axios incident).

**Severity:** High

## Architecture

```
src/
├── cli.ts                      # CLI entry point (scan, --live, --lockfile)
├── scanner.ts                  # Scan orchestration
├── types.ts                    # TypeScript interfaces & AlertType enum
├── detectors/
│   ├── install-scripts.ts      # Lifecycle script detection
│   ├── network-access.ts       # Network access detection (AST + regex)
│   ├── typosquat.ts            # Typosquat detection (Levenshtein distance)
│   ├── filesystem-access.ts    # Filesystem write/delete detection
│   ├── obfuscation.ts          # Shannon entropy analysis
│   └── shell-access.ts         # child_process / exec detection
├── ioc/
│   ├── known-bad.ts            # Known-compromised version database
│   └── lockfile-scanner.ts     # Lockfile IOC scanner (npm/yarn/pnpm)
├── npm/
│   ├── registry.ts             # Package fetching, extraction, 404 handling
│   └── feed.ts                 # Live CouchDB changes feed monitoring
└── utils/
    ├── logger.ts               # Output formatting (terminal, CI, GitHub Actions)
    └── environment.ts          # CI/CD environment detection
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
    
    return { detected: alerts.length > 0, alerts };
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
git clone https://github.com/Sunrostern/npm-scanner
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
- Shell access detection (child_process, exec, spawn)
- Obfuscation detection (entropy analysis)
- Network access detection (http, fetch, axios, etc.)
- Filesystem access detection (fs module operations)
- Typosquat detection (Levenshtein distance)
- Edge cases and error handling

## Known Limitations

- **Static analysis only** - Cannot detect runtime behavior or dynamically constructed payloads
- **Registry-dependent** - If a version is unpublished, tarball scanning falls back to lockfile IOC mode; no tarball analysis is possible
- **Obfuscation ceiling** - Sufficiently layered obfuscation may fall below the entropy threshold
- **False positives** - Legitimate packages may trigger alerts (e.g., HTTP clients flagged for network access)
- **Known-bad database** - Only incidents explicitly added to `src/ioc/known-bad.ts` are covered; zero-day supply chain attacks are not detected until the database is updated

## Performance

- Single package scan: 500ms - 2s
- Network detection: 100-500ms
- Typosquat check: ~50ms
- Live mode throughput: 1-2 packages/second

## Contributing

Contributions welcome! Areas of interest:
- Expanding `src/ioc/known-bad.ts` with new supply chain incidents
- New detectors (crypto mining, prototype pollution, data exfiltration patterns)
- Performance improvements (parallel lockfile parsing, caching)
- Better obfuscation detection (multi-pass entropy, AST-based deobfuscation)
- Additional CI/CD integrations

## License

MIT
