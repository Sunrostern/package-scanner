import fetch from 'node-fetch';
import * as tar from 'tar';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/** Thrown when a package version returns HTTP 404 from the registry. */
export class PackageNotFoundError extends Error {
  constructor(public readonly packageName: string, public readonly version: string) {
    super(`Failed to fetch package metadata: Not Found`);
    this.name = 'PackageNotFoundError';
  }
}

export interface PackageInfo {
  name: string;
  version: string;
  tarballPath: string;
  extractedPath: string;
}

export class NpmRegistry {
  private static readonly REGISTRY_URL = 'https://registry.npmjs.org';
  private static readonly TEMP_DIR = path.join(os.tmpdir(), 'npm-scanner');

  static async fetchPackage(packageName: string, version: string): Promise<PackageInfo> {
    const encodedName = packageName.replace('/', '%2F');
    const url = `${this.REGISTRY_URL}/${encodedName}/${version}`;

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        throw new PackageNotFoundError(packageName, version);
      }
      throw new Error(`Failed to fetch package metadata: ${response.statusText}`);
    }

    const metadata = await response.json() as any;
    const tarballUrl = metadata.dist?.tarball;

    if (!tarballUrl) {
      throw new Error('Tarball URL not found in package metadata');
    }

    const tarballPath = await this.downloadTarball(tarballUrl, packageName, version);
    const extractedPath = await this.extractTarball(tarballPath, packageName, version);

    return {
      name: packageName,
      version,
      tarballPath,
      extractedPath,
    };
  }

  private static async downloadTarball(
    url: string,
    packageName: string,
    version: string
  ): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download tarball: ${response.statusText}`);
    }

    await fs.promises.mkdir(this.TEMP_DIR, { recursive: true });
    
    const sanitizedName = packageName.replace(/\//g, '-');
    const tarballPath = path.join(this.TEMP_DIR, `${sanitizedName}-${version}.tgz`);
    
    const buffer = await response.buffer();
    await fs.promises.writeFile(tarballPath, buffer);

    return tarballPath;
  }

  private static async extractTarball(
    tarballPath: string,
    packageName: string,
    version: string
  ): Promise<string> {
    const sanitizedName = packageName.replace(/\//g, '-');
    const extractPath = path.join(this.TEMP_DIR, `${sanitizedName}-${version}`);

    await fs.promises.mkdir(extractPath, { recursive: true });

    await tar.extract({
      file: tarballPath,
      cwd: extractPath,
      strip: 1,
    });

    return extractPath;
  }

  static async cleanup(packageInfo: PackageInfo): Promise<void> {
    try {
      await fs.promises.rm(packageInfo.tarballPath, { force: true });
      await fs.promises.rm(packageInfo.extractedPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  static async getPopularPackages(limit: number = 1000): Promise<string[]> {
    try {
      const response = await fetch(
        'https://api.npmjs.org/downloads/range/last-month',
        { timeout: 5000 }
      );
      
      if (!response.ok) {
        return this.getFallbackPopularPackages();
      }

      const data = await response.json() as any;
      return data.slice(0, limit).map((pkg: any) => pkg.package);
    } catch (error) {
      return this.getFallbackPopularPackages();
    }
  }

  private static getFallbackPopularPackages(): string[] {
    return [
      'react', 'lodash', 'express', 'axios', 'webpack', 'typescript', 'eslint',
      'prettier', 'jest', 'babel', 'vue', 'angular', 'next', 'redux', 'moment',
      'chalk', 'commander', 'dotenv', 'cors', 'body-parser', 'mongoose', 'sequelize', 'passport', 'bcrypt', 'jsonwebtoken', 'nodemon', 'mocha', 'chai',
      'request', 'async', 'underscore', 'jquery', 'bootstrap', 'tailwindcss',
    ];
  }
}
