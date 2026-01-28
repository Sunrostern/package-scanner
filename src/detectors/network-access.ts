import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { Alert, AlertType, DetectorResult } from '../types';

export class NetworkAccessDetector {
  private static readonly NETWORK_PATTERNS = {
    modules: [
      'http', 'https', 'net', 'dgram', 'dns',
      'axios', 'request', 'node-fetch', 'got', 'superagent',
      'needle', 'bent', 'ky', 'undici', 'cross-fetch',
    ],
    globals: [
      'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource',
    ],
    methods: [
      'fetch', 'XMLHttpRequest', 'WebSocket',
    ],
  };

  private static readonly REGEX_PATTERNS = [
    /require\s*\(\s*['"`](https?|net|dgram|dns)['"]\s*\)/g,
    /import\s+.*\s+from\s+['"`](https?|net|dgram|dns|axios|node-fetch|got)['"]/g,
    /new\s+XMLHttpRequest\s*\(/g,
    /new\s+WebSocket\s*\(/g,
    /\.fetch\s*\(/g,
    /fetch\s*\(/g,
  ];

  static async detect(packagePath: string): Promise<DetectorResult> {
    const alerts: Alert[] = [];
    const detectedPatterns = new Set<string>();

    try {
      const files = await this.getAllJsFiles(packagePath);
      
      for (const file of files) {
        const content = await fs.promises.readFile(file, 'utf-8');
        
        const staticResults = this.detectStaticPatterns(content, file);
        staticResults.forEach(pattern => detectedPatterns.add(pattern));
        
        try {
          const astResults = await this.detectViaAST(content, file);
          astResults.forEach(pattern => detectedPatterns.add(pattern));
        } catch (error) {
          // AST parsing failed, rely on regex patterns
        }
      }

      if (detectedPatterns.size > 0) {
        alerts.push({
          type: AlertType.NETWORK_ACCESS,
          severity: 'medium',
          message: `Package makes network requests`,
          details: {
            patterns: Array.from(detectedPatterns),
            count: detectedPatterns.size,
          },
        });
      }
    } catch (error) {
      // Error reading files
    }

    return {
      detected: alerts.length > 0,
      alerts,
    };
  }

  private static detectStaticPatterns(content: string, filePath: string): string[] {
    const found: string[] = [];

    for (const pattern of this.REGEX_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        found.push(`Regex match: ${pattern.source}`);
      }
    }

    for (const module of this.NETWORK_PATTERNS.modules) {
      if (
        content.includes(`require('${module}')`) ||
        content.includes(`require("${module}")`) ||
        content.includes(`from '${module}'`) ||
        content.includes(`from "${module}"`)
      ) {
        found.push(`Module: ${module}`);
      }
    }

    for (const global of this.NETWORK_PATTERNS.globals) {
      const globalRegex = new RegExp(`\\b${global}\\s*\\(`, 'g');
      if (globalRegex.test(content)) {
        found.push(`Global: ${global}`);
      }
    }

    return found;
  }

  private static async detectViaAST(content: string, filePath: string): Promise<string[]> {
    const found: string[] = [];

    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
        errorRecovery: true,
      });

      traverse(ast, {
        ImportDeclaration(path) {
          const source = path.node.source.value;
          if (NetworkAccessDetector.NETWORK_PATTERNS.modules.includes(source)) {
            found.push(`Import: ${source}`);
          }
        },
        CallExpression(path) {
          if (path.node.callee.type === 'Identifier') {
            const name = path.node.callee.name;
            if (NetworkAccessDetector.NETWORK_PATTERNS.methods.includes(name)) {
              found.push(`Call: ${name}()`);
            }
          }
          
          if (
            path.node.callee.type === 'Identifier' &&
            path.node.callee.name === 'require'
          ) {
            const arg = path.node.arguments[0];
            if (arg && arg.type === 'StringLiteral') {
              if (NetworkAccessDetector.NETWORK_PATTERNS.modules.includes(arg.value)) {
                found.push(`Require: ${arg.value}`);
              }
            }
          }
        },
        NewExpression(path) {
          if (path.node.callee.type === 'Identifier') {
            const name = path.node.callee.name;
            if (['XMLHttpRequest', 'WebSocket', 'EventSource'].includes(name)) {
              found.push(`New: ${name}`);
            }
          }
        },
      });
    } catch (error) {
      // AST parsing failed
    }

    return found;
  }

  private static async getAllJsFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await this.getAllJsFiles(fullPath);
        files.push(...subFiles);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.js') ||
          entry.name.endsWith('.ts') ||
          entry.name.endsWith('.jsx') ||
          entry.name.endsWith('.tsx') ||
          entry.name.endsWith('.mjs') ||
          entry.name.endsWith('.cjs'))
      ) {
        files.push(fullPath);
      }
    }

    return files;
  }
}
