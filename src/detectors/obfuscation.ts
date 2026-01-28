import * as fs from 'fs';
import * as path from 'path';
import { Alert, AlertType, DetectorResult } from '../types';

export class ObfuscationDetector {
  private static readonly ENTROPY_THRESHOLD = 5.5;
  private static readonly MIN_FILE_SIZE = 100; // bytes

  static async detect(packagePath: string): Promise<DetectorResult> {
    const alerts: Alert[] = [];
    const suspiciousFiles: Array<{ file: string; entropy: number }> = [];

    try {
      const files = this.getAllJsFiles(packagePath);

      for (const file of files) {
        const content = await fs.promises.readFile(file, 'utf-8');
        
        // Skip small files
        if (content.length < this.MIN_FILE_SIZE) {
          continue;
        }

        const entropy = this.calculateEntropy(content);
        
        if (entropy > this.ENTROPY_THRESHOLD) {
          suspiciousFiles.push({
            file: path.relative(packagePath, file),
            entropy: Math.round(entropy * 100) / 100,
          });
        }
      }

      if (suspiciousFiles.length > 0) {
        alerts.push({
          type: AlertType.OBFUSCATED_CODE,
          severity: 'high',
          message: 'Package contains obfuscated code with high entropy',
          details: {
            files: suspiciousFiles,
            threshold: this.ENTROPY_THRESHOLD,
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

  private static calculateEntropy(str: string): number {
    const freq: Record<string, number> = {};
    
    // Count character frequencies
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    // Calculate Shannon entropy
    let entropy = 0;
    const len = str.length;
    
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
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
