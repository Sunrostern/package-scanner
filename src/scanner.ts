import { NpmRegistry, PackageInfo, PackageNotFoundError } from './npm/registry';
import { InstallScriptDetector } from './detectors/install-scripts';
import { NetworkAccessDetector } from './detectors/network-access';
import { TyposquatDetector } from './detectors/typosquat';
import { FilesystemAccessDetector } from './detectors/filesystem-access';
import { ObfuscationDetector } from './detectors/obfuscation';
import { ShellAccessDetector } from './detectors/shell-access';
import { ScanResult, Alert, AlertType } from './types';
import { Logger } from './utils/logger';
import { lookupKnownBad } from './ioc/known-bad';
import { LockfileScanner } from './ioc/lockfile-scanner';

export class PackageScanner {
  async scan(packageName: string, version: string): Promise<ScanResult> {
    let packageInfo: PackageInfo | null = null;
    const startTime = Date.now();

    try {
      Logger.header(`Scanning ${packageName}@${version}`, '🔍');

      packageInfo = await NpmRegistry.fetchPackage(packageName, version);

      const alerts: Alert[] = [];

      const [
        installScriptResult,
        networkAccessResult,
        typosquatResult,
        filesystemResult,
        obfuscationResult,
        shellAccessResult,
      ] = await Promise.all([
        InstallScriptDetector.detect(packageInfo.extractedPath),
        NetworkAccessDetector.detect(packageInfo.extractedPath),
        TyposquatDetector.detect(packageName),
        FilesystemAccessDetector.detect(packageInfo.extractedPath),
        ObfuscationDetector.detect(packageInfo.extractedPath),
        ShellAccessDetector.detect(packageInfo.extractedPath),
      ]);

      alerts.push(...installScriptResult.alerts);
      alerts.push(...networkAccessResult.alerts);
      alerts.push(...typosquatResult.alerts);
      alerts.push(...filesystemResult.alerts);
      alerts.push(...obfuscationResult.alerts);
      alerts.push(...shellAccessResult.alerts);

      const result: ScanResult = {
        packageName,
        version,
        alerts,
        scannedAt: new Date(),
      };

      const duration = Date.now() - startTime;
      this.displayResults(result, duration);

      return result;
    } catch (error) {
      if (error instanceof PackageNotFoundError) {
        const entry = lookupKnownBad(packageName, version);

        if (entry) {
          Logger.warning(
            `${packageName}@${version} was unpublished from npm — matches known-compromised version list`
          );
          Logger.info('Scanning local lockfiles for evidence of prior installation...');

          const alerts: Alert[] = [
            {
              type: AlertType.KNOWN_COMPROMISED,
              severity: 'high',
              message:
                `${packageName}@${version} is a known-compromised version that was removed from npm`,
              details: {
                incident: entry.incident,
                date: entry.date,
                description: entry.ioc.description,
                maliciousDependencies: entry.ioc.maliciousDependencies ?? [],
                references: entry.ioc.references ?? [],
              },
            },
          ];

          const lockfileResult = await LockfileScanner.scanDirectory(process.cwd());
          alerts.push(...lockfileResult.alerts);

          const result: ScanResult = { packageName, version, alerts, scannedAt: new Date() };
          const duration = Date.now() - startTime;
          this.displayResults(result, duration);
          return result;
        }

        Logger.warning(
          `${packageName}@${version} not found on npm registry (may have been unpublished)`
        );
      } else {
        Logger.error(
          `Failed to scan ${packageName}@${version}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }

      return {
        packageName,
        version,
        alerts: [],
        scannedAt: new Date(),
      };
    } finally {
      if (packageInfo) {
        await NpmRegistry.cleanup(packageInfo);
      }
    }
  }

  private displayResults(result: ScanResult, duration: number): void {
    if (result.alerts.length === 0) {
      Logger.summary(result.packageName, result.version, 0, duration);
      return;
    }

    Logger.section('🛡️  Security Alerts');

    // Group alerts by severity
    const highAlerts = result.alerts.filter(a => a.severity === 'high');
    const mediumAlerts = result.alerts.filter(a => a.severity === 'medium');
    const lowAlerts = result.alerts.filter(a => a.severity === 'low');

    // Display high severity first
    [...highAlerts, ...mediumAlerts, ...lowAlerts].forEach(alert => {
      Logger.alertBox(alert.severity, alert.type, alert.message, alert.details);
    });

    Logger.summary(result.packageName, result.version, result.alerts.length, duration);
  }
}
