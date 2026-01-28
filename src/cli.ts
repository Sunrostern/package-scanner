#!/usr/bin/env node

import { Command } from 'commander';
import { PackageScanner } from './scanner';
import { NpmFeed } from './npm/feed';
import { Logger } from './utils/logger';

const program = new Command();

program
  .name('npm-scanner')
  .description('Real-time malware scanner for npm packages')
  .version('1.0.0');

program
  .argument('[package-name]', 'Name of the package to scan')
  .argument('[version]', 'Version of the package to scan')
  .option('-l, --live', 'Monitor npm feed for new packages in real-time')
  .action(async (packageName: string | undefined, version: string | undefined, options: any) => {
    if (options.live) {
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
