export class Environment {
  static isCI(): boolean {
    return !!(
      process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.CIRCLECI ||
      process.env.TRAVIS ||
      process.env.JENKINS_URL ||
      process.env.BUILDKITE ||
      process.env.DRONE ||
      process.env.TF_BUILD // Azure Pipelines
    );
  }

  static isGitHubActions(): boolean {
    return !!process.env.GITHUB_ACTIONS;
  }

  static supportsColor(): boolean {
    if (this.isCI()) {
      // Some CI systems support color
      return !!(
        process.env.FORCE_COLOR ||
        process.env.COLORTERM ||
        (process.env.TERM && process.env.TERM !== 'dumb')
      );
    }
    return true;
  }

  static supportsUnicode(): boolean {
    // CI environments often don't render Unicode well
    if (this.isCI()) {
      return false;
    }
    return true;
  }
}
