import * as levenshtein from 'fast-levenshtein';
import { Alert, AlertType, DetectorResult } from '../types';
import { NpmRegistry } from '../npm/registry';

export class TyposquatDetector {
  private static popularPackages: string[] = [];
  private static initialized: boolean = false;

  private static readonly MAX_DISTANCE = 2;
  private static readonly MIN_SIMILARITY = 0.75;

  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.popularPackages = await NpmRegistry.getPopularPackages(1000);
      this.initialized = true;
    } catch (error) {
      this.popularPackages = [];
      this.initialized = true;
    }
  }

  static async detect(packageName: string): Promise<DetectorResult> {
    await this.initialize();

    const alerts: Alert[] = [];
    const suspiciousMatches: Array<{ package: string; distance: number; similarity: number }> = [];

    for (const popularPkg of this.popularPackages) {
      if (packageName === popularPkg) {
        continue;
      }

      const distance = levenshtein.get(packageName, popularPkg);
      
      if (distance <= this.MAX_DISTANCE && distance > 0) {
        const maxLen = Math.max(packageName.length, popularPkg.length);
        const similarity = 1 - distance / maxLen;
        
        if (similarity >= this.MIN_SIMILARITY) {
          suspiciousMatches.push({
            package: popularPkg,
            distance,
            similarity: Math.round(similarity * 100) / 100,
          });
        }
      }
    }

    if (suspiciousMatches.length > 0) {
      suspiciousMatches.sort((a, b) => a.distance - b.distance);
      
      const topMatch = suspiciousMatches[0];
      alerts.push({
        type: AlertType.TYPOSQUAT,
        severity: topMatch.distance === 1 ? 'high' : 'medium',
        message: `Potential typosquat of popular package "${topMatch.package}" (distance: ${topMatch.distance})`,
        details: {
          suspiciousMatches: suspiciousMatches.slice(0, 5),
          targetPackage: packageName,
        },
      });
    }

    return {
      detected: alerts.length > 0,
      alerts,
    };
  }
}
