import chalk from 'chalk';
import { Environment } from './environment';

export class Logger {
  private static useCI = Environment.isCI();
  private static useColor = Environment.supportsColor();
  private static useUnicode = Environment.supportsUnicode();
  private static isGitHub = Environment.isGitHubActions();
  static info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  static success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  static warning(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  static error(message: string): void {
    console.error(chalk.red('✗'), message);
  }

  static alert(type: string, message: string): void {
    const icon = type === 'high' ? '🚨' : type === 'medium' ? '⚠️' : 'ℹ️';
    console.log(chalk.red(`${icon} ALERT:`), message);
  }

  static packageScan(packageName: string, version: string): void {
    console.log(chalk.cyan('\n📦 Scanning:'), `${packageName}@${version}`);
  }

  static newPackage(packageName: string, version: string): void {
    console.log(chalk.magenta('\n🆕 New package published:'), `${packageName}@${version}`);
  }

  static box(content: string, color: 'green' | 'red' | 'yellow' | 'cyan' = 'cyan'): void {
    const lines = content.split('\n');
    const maxLength = Math.max(...lines.map(l => l.length));
    const width = Math.min(maxLength + 4, 80);
    
    const colorFn = chalk[color];
    const top = colorFn('┌' + '─'.repeat(width - 2) + '┐');
    const bottom = colorFn('└' + '─'.repeat(width - 2) + '┘');
    
    console.log('\n' + top);
    lines.forEach(line => {
      const padding = ' '.repeat(Math.max(0, width - line.length - 4));
      console.log(colorFn('│') + ' ' + line + padding + ' ' + colorFn('│'));
    });
    console.log(bottom);
  }

  static header(text: string, icon: string = '🔍'): void {
    if (this.useCI) {
      console.log('\n' + '='.repeat(60));
      console.log(`${this.useUnicode ? icon : '>'} ${text}`);
      console.log('='.repeat(60));
    } else {
      console.log('\n' + chalk.bold.cyan('═'.repeat(60)));
      console.log(chalk.bold.white(`  ${icon}  ${text}`));
      console.log(chalk.bold.cyan('═'.repeat(60)));
    }
  }

  static section(title: string): void {
    if (this.useCI) {
      console.log('\n' + title);
      console.log('-'.repeat(60));
    } else {
      console.log('\n' + chalk.bold.white(title));
      console.log(chalk.gray('─'.repeat(60)));
    }
  }

  static alertBox(severity: string, type: string, message: string, details?: any): void {
    // GitHub Actions annotations
    if (this.isGitHub) {
      const command = severity === 'high' ? 'error' : severity === 'medium' ? 'warning' : 'notice';
      const typeFormatted = type.toUpperCase().replace(/_/g, ' ');
      console.log(`::${command}::${typeFormatted}: ${message}`);
      
      if (details) {
        if (Array.isArray(details.patterns)) {
          console.log(`::${command}::Detected patterns: ${details.patterns.slice(0, 3).join(', ')}`);
        } else if (details.scripts) {
          console.log(`::${command}::Scripts: ${Object.keys(details.scripts).join(', ')}`);
        } else if (details.similarTo) {
          console.log(`::${command}::Similar to ${details.similarTo} (${(details.similarity * 100).toFixed(1)}% match)`);
        }
      }
      return;
    }
    
    // CI plain text mode
    if (this.useCI) {
      const severityLabel = `[${severity.toUpperCase()}]`;
      const typeLabel = type.toUpperCase().replace(/_/g, ' ');
      
      console.log('\n' + '='.repeat(60));
      console.log(`${severityLabel} ${typeLabel}`);
      console.log(message);
      
      if (details) {
        if (Array.isArray(details.patterns)) {
          console.log('\nDetected patterns:');
          details.patterns.slice(0, 5).forEach((pattern: string) => {
            console.log(`  - ${pattern}`);
          });
          if (details.patterns.length > 5) {
            console.log(`  ... and ${details.patterns.length - 5} more`);
          }
        } else if (details.scripts) {
          console.log('\nScripts found:');
          Object.entries(details.scripts).forEach(([key, value]) => {
            console.log(`  - ${key}: ${value}`);
          });
        } else if (details.similarTo) {
          console.log(`\nSimilar to: ${details.similarTo}`);
          console.log(`Distance: ${details.distance}, Similarity: ${(details.similarity * 100).toFixed(1)}%`);
        }
      }
      console.log('='.repeat(60));
      return;
    }
    
    // Local terminal mode with colors and Unicode
    const severityColors = {
      high: 'red',
      medium: 'yellow',
      low: 'blue'
    } as const;
    
    const severityIcons = {
      high: '🚨',
      medium: '⚠️',
      low: 'ℹ️'
    };
    
    const color = severityColors[severity as keyof typeof severityColors] || 'yellow';
    const icon = severityIcons[severity as keyof typeof severityIcons] || '⚠️';
    const colorFn = chalk[color];
    
    console.log('\n' + colorFn('┌─ ' + icon + '  ' + severity.toUpperCase() + ' SEVERITY ') + colorFn('─'.repeat(40)));
    console.log(colorFn('│'));
    console.log(colorFn('│  ') + chalk.bold.white(type.toUpperCase().replace(/_/g, ' ')));
    console.log(colorFn('│  ') + chalk.white(message));
    
    if (details) {
      console.log(colorFn('│'));
      if (Array.isArray(details.patterns)) {
        console.log(colorFn('│  ') + chalk.gray('Detected patterns:'));
        details.patterns.slice(0, 5).forEach((pattern: string) => {
          console.log(colorFn('│    • ') + chalk.gray(pattern));
        });
        if (details.patterns.length > 5) {
          console.log(colorFn('│    ') + chalk.gray(`... and ${details.patterns.length - 5} more`));
        }
      } else if (details.scripts) {
        console.log(colorFn('│  ') + chalk.gray('Scripts found:'));
        Object.entries(details.scripts).forEach(([key, value]) => {
          console.log(colorFn('│    • ') + chalk.gray(`${key}: ${value}`));
        });
      } else if (details.similarTo) {
        console.log(colorFn('│  ') + chalk.gray(`Similar to: ${details.similarTo}`));
        console.log(colorFn('│  ') + chalk.gray(`Distance: ${details.distance}, Similarity: ${(details.similarity * 100).toFixed(1)}%`));
      }
    }
    
    console.log(colorFn('│'));
    console.log(colorFn('└') + colorFn('─'.repeat(60)));
  }

  static summary(packageName: string, version: string, alertCount: number, duration: number): void {
    if (this.useCI) {
      console.log('\n' + '='.repeat(60));
      
      if (alertCount === 0) {
        console.log('[PASS] SCAN COMPLETE - NO THREATS DETECTED');
      } else {
        console.log(`[WARN] SCAN COMPLETE - ${alertCount} ALERT${alertCount > 1 ? 'S' : ''} FOUND`);
      }
      
      console.log('='.repeat(60));
      console.log(`Package: ${packageName}@${version}`);
      console.log(`Scan time: ${duration}ms`);
      console.log(`Timestamp: ${new Date().toISOString()}`);
      console.log('='.repeat(60) + '\n');
    } else {
      console.log('\n' + chalk.bold.cyan('═'.repeat(60)));
      
      if (alertCount === 0) {
        console.log(chalk.bold.green('  ✓  SCAN COMPLETE - NO THREATS DETECTED'));
      } else {
        console.log(chalk.bold.yellow(`  ⚠  SCAN COMPLETE - ${alertCount} ALERT${alertCount > 1 ? 'S' : ''} FOUND`));
      }
      
      console.log(chalk.bold.cyan('═'.repeat(60)));
      console.log(chalk.gray(`  Package: ${packageName}@${version}`));
      console.log(chalk.gray(`  Scan time: ${duration}ms`));
      console.log(chalk.gray(`  Timestamp: ${new Date().toISOString()}`));
      console.log(chalk.bold.cyan('═'.repeat(60)) + '\n');
    }
  }
}
