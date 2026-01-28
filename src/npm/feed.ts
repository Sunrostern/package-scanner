import fetch from 'node-fetch';
import { Logger } from '../utils/logger';

export interface PackageChange {
  id: string;
  seq: number;
  changes: Array<{ rev: string }>;
  doc?: {
    name: string;
    'dist-tags'?: {
      latest?: string;
    };
    versions?: Record<string, any>;
  };
}

export class NpmFeed {
  private static readonly FEED_URL = 'https://replicate.npmjs.com';
  private lastSeq: number = 0;
  private isRunning: boolean = false;

  async start(onPackage: (name: string, version: string) => Promise<void>): Promise<void> {
    this.isRunning = true;
    
    Logger.header('Live Package Monitor', '📡');
    Logger.info('Connecting to npm registry feed...');
    
    const currentSeq = await this.getCurrentSeq();
    this.lastSeq = currentSeq;
    
    Logger.success(`Connected to npm feed (sequence: ${currentSeq})`);
    Logger.section('🔴 LIVE - Monitoring for new publications');
    console.log('');

    while (this.isRunning) {
      try {
        await this.pollChanges(onPackage);
        await this.sleep(1000);
      } catch (error) {
        Logger.error(`Feed error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        await this.sleep(5000);
      }
    }
  }

  stop(): void {
    this.isRunning = false;
    Logger.info('Stopping npm feed monitor...');
  }

  private async getCurrentSeq(): Promise<number> {
    const response = await fetch(NpmFeed.FEED_URL);
    if (!response.ok) {
      throw new Error(`Failed to connect to npm feed: ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    return data.update_seq || 0;
  }

  private async pollChanges(onPackage: (name: string, version: string) => Promise<void>): Promise<void> {
    const url = `${NpmFeed.FEED_URL}/_changes?since=${this.lastSeq}&include_docs=true&limit=100`;
    
    const response = await fetch(url, { timeout: 30000 });
    if (!response.ok) {
      throw new Error(`Failed to fetch changes: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const results = data.results || [];

    for (const change of results) {
      if (change.doc && change.doc.name && change.doc['dist-tags']?.latest) {
        const packageName = change.doc.name;
        const version = change.doc['dist-tags'].latest;
        
        try {
          await onPackage(packageName, version);
        } catch (error) {
          Logger.error(
            `Failed to scan ${packageName}@${version}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }
      
      this.lastSeq = change.seq;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
