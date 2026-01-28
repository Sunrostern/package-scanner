import { TyposquatDetector } from '../typosquat';

describe('TyposquatDetector', () => {
  beforeAll(async () => {
    // Initialize popular packages list
    await TyposquatDetector.detect('test-package');
  });

  it('should detect typosquat of react', async () => {
    const result = await TyposquatDetector.detect('reakt'); // 1 char different

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].type).toBe('typosquat');
    expect(result.alerts[0].severity).toBe('high');
    expect(result.alerts[0]?.details?.suspiciousMatches?.[0]?.package).toBe('react');
  });

  it('should detect typosquat of lodash', async () => {
    const result = await TyposquatDetector.detect('lodesh'); // 1 char different

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]?.details?.suspiciousMatches?.[0]?.package).toBe('lodash');
  });

  it('should not alert on legitimate packages', async () => {
    const result = await TyposquatDetector.detect('my-unique-package-name-12345');

    expect(result.alerts).toHaveLength(0);
  });

  it('should not alert on exact matches', async () => {
    const result = await TyposquatDetector.detect('react');

    expect(result.alerts).toHaveLength(0);
  });

  it('should handle very different names', async () => {
    const result = await TyposquatDetector.detect('completely-different-name');

    expect(result.alerts).toHaveLength(0);
  });

  it('should detect typosquat of express', async () => {
    const result = await TyposquatDetector.detect('expres'); // missing 's'

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]?.details?.suspiciousMatches?.[0]?.package).toBe('express');
    expect(result.alerts[0]?.details?.suspiciousMatches?.[0]?.distance).toBeLessThanOrEqual(2);
  });
});
