# CI/CD Integration Guide

The scanner automatically detects CI/CD environments and adapts its output format for optimal readability in logs and PR comments.

## Output Modes

### 🖥️ Local Terminal Mode
- **Rich colors** using ANSI escape codes
- **Unicode box characters** for visual appeal
- **Icons and emojis** for quick recognition
- Best for: Local development, interactive terminals

### 🤖 CI/CD Plain Text Mode
- **No colors** (plain text)
- **ASCII characters** instead of Unicode
- **Structured format** with clear labels
- Best for: GitLab CI, CircleCI, Jenkins, Travis CI

### 🐙 GitHub Actions Mode
- **Native annotations** (`::error::`, `::warning::`, `::notice::`)
- **Appears in PR checks** with file/line context
- **Collapsible details** in workflow logs
- Best for: GitHub Actions workflows

## Environment Detection

The scanner automatically detects:
- `CI=true` (most CI systems)
- `GITHUB_ACTIONS=true` (GitHub Actions)
- `GITLAB_CI=true` (GitLab CI)
- `CIRCLECI=true` (CircleCI)
- `TRAVIS=true` (Travis CI)
- `JENKINS_URL` (Jenkins)
- `BUILDKITE` (Buildkite)
- `TF_BUILD` (Azure Pipelines)

## GitHub Actions Integration

### Example Workflow

```yaml
name: Security Scan

on:
  pull_request:
    paths:
      - 'package.json'
      - 'pnpm-lock.yaml'

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      
      - name: Install scanner
        run: npm install -g npm-malware-scanner
      
      - name: Scan dependencies
        run: npm-scanner express 4.18.2
```

### GitHub Actions Output

When running in GitHub Actions, alerts appear as:

```
::error::INSTALL SCRIPTS: Package contains install scripts that execute arbitrary code
::warning::NETWORK ACCESS: Package makes network requests
::notice::Detected patterns: Module: http, Module: https, Require: http
```

These annotations:
- ✅ Appear in the **Checks** tab of PRs
- ✅ Show up as **file annotations** (if applicable)
- ✅ Are **collapsible** in workflow logs
- ✅ Have **severity levels** (error, warning, notice)

### Example PR Check Output

```
Annotations
  2 errors, 1 warning

❌ INSTALL SCRIPTS: Package contains install scripts that execute arbitrary code
   Scripts: postinstall, preinstall

⚠️ NETWORK ACCESS: Package makes network requests
   Detected patterns: Module: http, Module: https

✓ Scan completed in 1234ms
```

## GitLab CI Integration

### Example `.gitlab-ci.yml`

```yaml
security_scan:
  stage: test
  image: node:22
  script:
    - npm install -g npm-malware-scanner
    - npm-scanner express 4.18.2
  allow_failure: true
  artifacts:
    reports:
      junit: scan-results.xml
```

### GitLab CI Output

```
============================================================
> Scanning express@4.18.2
============================================================

Security Alerts
------------------------------------------------------------

============================================================
[MEDIUM] NETWORK ACCESS
Package makes network requests

Detected patterns:
  - Module: http
  - Module: https
  - Require: http
============================================================

============================================================
[WARN] SCAN COMPLETE - 1 ALERT FOUND
============================================================
Package: express@4.18.2
Scan time: 1234ms
Timestamp: 2026-01-28T05:38:15.508Z
============================================================
```

## CircleCI Integration

### Example `.circleci/config.yml`

```yaml
version: 2.1

jobs:
  security-scan:
    docker:
      - image: cimg/node:22.0
    steps:
      - checkout
      - run:
          name: Install scanner
          command: npm install -g npm-malware-scanner
      - run:
          name: Scan dependencies
          command: npm-scanner express 4.18.2

workflows:
  scan:
    jobs:
      - security-scan
```

## Jenkins Integration

### Example Jenkinsfile

```groovy
pipeline {
  agent any
  
  stages {
    stage('Security Scan') {
      steps {
        sh 'npm install -g npm-malware-scanner'
        sh 'npm-scanner express 4.18.2'
      }
    }
  }
  
  post {
    failure {
      echo 'Security alerts detected!'
    }
  }
}
```

## Scanning All Dependencies

### Scan package.json dependencies

```bash
#!/bin/bash
# scan-all-deps.sh

while IFS= read -r line; do
  if [[ $line =~ \"([^\"]+)\":\ *\"([^\"]+)\" ]]; then
    name="${BASH_REMATCH[1]}"
    version="${BASH_REMATCH[2]}"
    # Remove ^ and ~ from version
    version="${version#^}"
    version="${version#~}"
    
    echo "Scanning $name@$version..."
    npm-scanner "$name" "$version" || true
  fi
done < <(grep -A 999 '"dependencies"' package.json | grep -B 999 '^  }' | grep ':')
```

### Node.js script

```javascript
// scan-deps.js
const { execSync } = require('child_process');
const pkg = require('./package.json');

const deps = {
  ...pkg.dependencies,
  ...pkg.devDependencies
};

let hasAlerts = false;

for (const [name, version] of Object.entries(deps)) {
  const cleanVersion = version.replace(/^[\^~]/, '');
  console.log(`\nScanning ${name}@${cleanVersion}...`);
  
  try {
    execSync(`npm-scanner ${name} ${cleanVersion}`, { 
      stdio: 'inherit' 
    });
  } catch (error) {
    hasAlerts = true;
  }
}

if (hasAlerts) {
  console.error('\n❌ Security alerts found in dependencies');
  process.exit(1);
}

console.log('\n✅ All dependencies scanned successfully');
```

Run with:
```bash
node scan-deps.js
```

## Exit Codes

The scanner uses standard exit codes:
- `0` - No alerts detected (success)
- `1` - Alerts detected or scan failed (failure)

This allows CI/CD systems to:
- ✅ **Pass** builds with no alerts
- ❌ **Fail** builds with alerts
- ⚠️ **Warn** but continue (use `|| true` or `allow_failure`)

## Configuration Options

### Fail on High Severity Only

```bash
# Custom wrapper script
npm-scanner express 4.18.2 | tee scan.log
if grep -q "HIGH SEVERITY" scan.log; then
  exit 1
fi
```

### Continue on Warnings

```bash
# Don't fail the build on alerts
npm-scanner express 4.18.2 || true
```

### Parallel Scanning

```bash
# Scan multiple packages in parallel
npm-scanner express 4.18.2 &
npm-scanner axios 1.6.0 &
npm-scanner lodash 4.17.21 &
wait
```

## Best Practices

### 1. **Scan on PR, not on every commit**
```yaml
on:
  pull_request:
    paths:
      - 'package.json'
      - '*-lock.json'
```

### 2. **Cache scanner installation**
```yaml
- name: Cache scanner
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: scanner-${{ runner.os }}
```

### 3. **Set timeouts**
```yaml
- name: Scan dependencies
  timeout-minutes: 10
  run: npm-scanner express 4.18.2
```

### 4. **Use matrix for multiple packages**
```yaml
strategy:
  matrix:
    package:
      - express@4.18.2
      - axios@1.6.0
      - lodash@4.17.21
steps:
  - run: npm-scanner ${{ matrix.package }}
```

### 5. **Add to required checks**
In GitHub repo settings:
- Settings → Branches → Branch protection rules
- Add "Security Scan" to required status checks

## Output Examples

### Local Terminal
```
════════════════════════════════════════════════════════════
  🔍  Scanning express@4.18.2
════════════════════════════════════════════════════════════

🛡️  Security Alerts
────────────────────────────────────────────────────────────

┌─ ⚠️  MEDIUM SEVERITY ────────────────────────────────────
│
│  NETWORK ACCESS
│  Package makes network requests
│
│  Detected patterns:
│    • Module: http
│    • Module: https
│
└────────────────────────────────────────────────────────────
```

### GitHub Actions
```
::warning::NETWORK ACCESS: Package makes network requests
::warning::Detected patterns: Module: http, Module: https
```

### Other CI Systems
```
============================================================
[MEDIUM] NETWORK ACCESS
Package makes network requests

Detected patterns:
  - Module: http
  - Module: https
============================================================
```

## Troubleshooting

### Colors not showing in CI
Set environment variable:
```bash
export FORCE_COLOR=1
npm-scanner express 4.18.2
```

### Unicode characters broken
The scanner automatically uses ASCII in CI environments. If you see broken characters locally, your terminal may not support Unicode.

### GitHub annotations not appearing
Ensure you're using the correct syntax:
- Annotations only work in GitHub Actions
- Must be in the format `::error::message`
- Check workflow logs for syntax errors

## Support

For issues or questions:
- npm: https://www.npmjs.com/package/npm-malware-scanner
