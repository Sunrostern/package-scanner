import * as fs from 'fs';
import * as path from 'path';
import { Alert, AlertType, DetectorResult } from '../types';

export class InstallScriptDetector {
  private static readonly RISKY_SCRIPTS = [
    'preinstall',
    'install',
    'postinstall',
    'preuninstall',
    'uninstall',
    'postuninstall',
  ];

  static async detect(packagePath: string): Promise<DetectorResult> {
    const alerts: Alert[] = [];
    
    try {
      const packageJsonPath = path.join(packagePath, 'package.json');
      const packageJson = JSON.parse(
        await fs.promises.readFile(packageJsonPath, 'utf-8')
      );

      const scripts = packageJson.scripts || {};
      const foundScripts: string[] = [];

      for (const scriptName of this.RISKY_SCRIPTS) {
        if (scripts[scriptName]) {
          foundScripts.push(scriptName);
        }
      }

      if (foundScripts.length > 0) {
        alerts.push({
          type: AlertType.INSTALL_SCRIPT,
          severity: 'high',
          message: `Package contains install scripts: ${foundScripts.join(', ')}`,
          details: {
            scripts: foundScripts.reduce((acc, name) => {
              acc[name] = scripts[name];
              return acc;
            }, {} as Record<string, string>),
          },
        });
      }
    } catch (error) {
      // If package.json doesn't exist or is invalid, no install scripts
    }

    return {
      detected: alerts.length > 0,
      alerts,
    };
  }
}
