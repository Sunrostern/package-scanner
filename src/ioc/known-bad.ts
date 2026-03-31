export interface KnownBadEntry {
  package: string;
  versions: string[];
  incident: string;
  date: string;
  ioc: {
    maliciousDependencies?: string[];
    description: string;
    references?: string[];
  };
}

export const KNOWN_BAD_VERSIONS: KnownBadEntry[] = [
  {
    package: 'axios',
    versions: ['1.14.1', '0.30.4'],
    incident: 'Axios npm supply chain compromise',
    date: '2025-03-26',
    ioc: {
      maliciousDependencies: ['plain-crypto-js'],
      description:
        'Attacker published malicious versions that inject plain-crypto-js to steal ' +
        'credentials and environment variables. Versions were unpublished by npm after detection.',
      references: [
        'https://socket.dev/npm/package/axios',
        'https://github.com/axios/axios/issues/6618',
      ],
    },
  },
];

export function lookupKnownBad(packageName: string, version: string): KnownBadEntry | null {
  return (
    KNOWN_BAD_VERSIONS.find(
      e => e.package === packageName && e.versions.includes(version)
    ) ?? null
  );
}

/** All unique IOC dependency names across every known-bad entry. */
export function getAllKnownBadIOCDeps(): string[] {
  const deps = new Set<string>();
  for (const entry of KNOWN_BAD_VERSIONS) {
    for (const dep of entry.ioc.maliciousDependencies ?? []) {
      deps.add(dep);
    }
  }
  return Array.from(deps);
}
