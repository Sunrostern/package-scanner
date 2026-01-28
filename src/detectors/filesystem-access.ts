import * as fs from 'fs';
import * as path from 'path';
import { Alert, AlertType, DetectorResult } from '../types';

export class FilesystemAccessDetector {
  private static readonly FS_PATTERNS = [
    // Require/import patterns
    /require\s*\(\s*['"`]fs['"`]\s*\)/g,
    /require\s*\(\s*['"`]fs\/promises['"`]\s*\)/g,
    /import.*from\s*['"`]fs['"`]/g,
    /import.*from\s*['"`]fs\/promises['"`]/g,
    
    // Dangerous operations
    /fs\.writeFile/g,
    /fs\.writeFileSync/g,
    /fs\.appendFile/g,
    /fs\.appendFileSync/g,
    /fs\.unlink/g,
    /fs\.unlinkSync/g,
    /fs\.rmdir/g,
    /fs\.rmdirSync/g,
    /fs\.rm\(/g,
    /fs\.rmSync/g,
    /fs\.mkdir/g,
    /fs\.mkdirSync/g,
    /fs\.rename/g,
    /fs\.renameSync/g,
    /fs\.chmod/g,
    /fs\.chmodSync/g,
  ];

  static async detect(packagePath: string): Promise<DetectorResult> {
    const alerts: Alert[] = [];
    const matches = new Set<string>();

    try {
      const files = this.getAllJsFiles(packagePath);

      for (const file of files) {
        const content = await fs.promises.readFile(file, 'utf-8');
        
        for (const pattern of this.FS_PATTERNS) {
          const regexMatches = content.match(pattern);
          if (regexMatches) {
            regexMatches.forEach(match => matches.add(match.trim()));
          }
        }
      }

      if (matches.size > 0) {
        alerts.push({
          type: AlertType.FILESYSTEM_ACCESS,
          severity: 'medium',
          message: 'Package accesses the filesystem',
          details: {
            patterns: Array.from(matches),
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
