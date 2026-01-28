export enum AlertType {
  INSTALL_SCRIPT = 'install_script',
  NETWORK_ACCESS = 'network_access',
  TYPOSQUAT = 'typosquat',
  FILESYSTEM_ACCESS = 'filesystem_access',
  OBFUSCATED_CODE = 'obfuscated_code',
  SHELL_ACCESS = 'shell_access',
}

export interface Alert {
  type: AlertType;
  severity: 'low' | 'medium' | 'high';
  message: string;
  details?: Record<string, any>;
}

export interface ScanResult {
  packageName: string;
  version: string;
  alerts: Alert[];
  scannedAt: Date;
}

export interface PackageMetadata {
  name: string;
  version: string;
  hasInstallScripts: boolean;
  scripts?: Record<string, string>;
}

export interface NetworkAccessPattern {
  type: string;
  location: string;
  code?: string;
}

export interface DetectorResult {
  detected: boolean;
  alerts: Alert[];
}
