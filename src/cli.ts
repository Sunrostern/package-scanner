#!/usr/bin/env node

import { Command } from 'commander';
import { PackageScanner } from './scanner';
import { NpmFeed } from './npm/feed';
import { Logger } from './utils/logger';
import { LockfileScanner } from './ioc/lockfile-scanner';
import * as path from 'path';
import * as fs from 'fs';

const program = new Command();

program
  .name('npm-scanner')
  .description('Real-time malware scanner for npm packages')
  .version('1.0.0');

program
  .argument('[package-name]', 'Name of the package to scan')
  .argument('[version]', 'Version of the package to scan')
  .option('-l, --live', 'Monitor npm feed for new packages in real-time')
  .option('--lockfile [path]', 'Scan lockfiles for known-compromised packages (default: current directory)')
  .action(async (packageName: string | undefined, version: string | undefined, options: any) => {
    if (options.lockfile !== undefined) {
      const target = typeof options.lockfile === 'string' ? options.lockfile : process.cwd();
      await runLockfileScan(target);
    } else if (options.live) {
      await runLiveMode();
    } else if (packageName && version) {
      await runSingleScan(packageName, version);
    } else {
      Logger.error('Please provide package name and version, or use --live flag');
      program.help();
    }
  });

async function runSingleScan(packageName: string, version: string): Promise<void> {
  const scanner = new PackageScanner();
  
  try {
    await scanner.scan(packageName, version);
  } catch (error) {
    Logger.error(`Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

async function runLockfileScan(target: string): Promise<void> {
  let dir: string;
  try {
    const stat = await fs.promises.stat(target);
    dir = stat.isDirectory() ? target : path.dirname(target);
  } catch {
    Logger.error(`Path not found: ${target}`);
    process.exit(1);
  }

  Logger.header('Scanning lockfiles for known-compromised packages', '🔒');

  const result = await LockfileScanner.scanDirectory(dir);

  if (result.alerts.length === 0) {
    Logger.success('No known-compromised packages or IOC dependencies found in lockfiles');
  } else {
    Logger.section('🛡️  Security Alerts');
    result.alerts.forEach(alert => {
      Logger.alertBox(alert.severity, alert.type, alert.message, alert.details);
    });
    Logger.error(`Found ${result.alerts.length} issue(s) in lockfiles`);
    process.exit(1);
  }
}

async function runLiveMode(): Promise<void> {
  const scanner = new PackageScanner();
  const feed = new NpmFeed();

  Logger.info('Starting live monitoring mode...');
  Logger.info('Press Ctrl+C to stop\n');

  process.on('SIGINT', () => {
    Logger.info('\nShutting down gracefully...');
    feed.stop();
    process.exit(0);
  });

  await feed.start(async (packageName: string, version: string) => {
    Logger.newPackage(packageName, version);
    await scanner.scan(packageName, version);
  });
}

program.parse();
