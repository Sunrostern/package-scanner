import * as fs from 'fs';
import * as path from 'path';
import { Alert, AlertType, DetectorResult } from '../types';

export class ShellAccessDetector {
  private static readonly SHELL_PATTERNS = [
    // child_process module
    /require\s*\(\s*['"`]child_process['"`]\s*\)/g,
    /import.*from\s*['"`]child_process['"`]/g,
    
    // Dangerous functions
    /child_process\.exec\(/g,
    /child_process\.execSync\(/g,
    /child_process\.spawn\(/g,
    /child_process\.spawnSync\(/g,
    /child_process\.execFile\(/g,
    /child_process\.execFileSync\(/g,
    /child_process\.fork\(/g,
    
    // Direct usage (after destructuring)
    /\bexec\s*\(/g,
    /\bexecSync\s*\(/g,
    /\bspawn\s*\(/g,
    /\bspawnSync\s*\(/g,
    /\bexecFile\s*\(/g,
    /\bexecFileSync\s*\(/g,
    
    // Shell command strings (common patterns)
    /['"`].*(?:bash|sh|cmd|powershell|zsh).*['"`]/g,
  ];

  static async detect(packagePath: string): Promise<DetectorResult> {
    const alerts: Alert[] = [];
    const matches = new Set<string>();

    try {
      const files = this.getAllJsFiles(packagePath);

      for (const file of files) {
        const content = await fs.promises.readFile(file, 'utf-8');
        
        for (const pattern of this.SHELL_PATTERNS) {
          const regexMatches = content.match(pattern);
          if (regexMatches) {
            regexMatches.forEach(match => {
              // Limit match length for display
              const trimmed = match.trim().substring(0, 100);
              matches.add(trimmed);
            });
          }
        }
      }

      if (matches.size > 0) {
        alerts.push({
          type: AlertType.SHELL_ACCESS,
          severity: 'high',
          message: 'Package executes shell commands',
          details: {
            patterns: Array.from(matches).slice(0, 10),
            count: matches.size,
          },
        });
      }
    } catch (error) {
      // Ignore errors
    }

    return {
      detected: alerts.length > 0,
      alerts,
    };
  }

  private static getAllJsFiles(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            files.push(...this.getAllJsFiles(fullPath));
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'].includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return files;
  }
}
