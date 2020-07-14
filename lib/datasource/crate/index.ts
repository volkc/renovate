import * as packageCache from '../../util/cache/package';
import { GetReleasesConfig, Release, ReleaseResult } from '../common';
import { Datasource } from '../datasource';

export const id = 'crate';

interface CrateRecord {
  vers: string;
  yanked: boolean;
}

export class Crate extends Datasource {
  readonly id = 'crate';

  readonly BASE_URL =
    'https://raw.githubusercontent.com/rust-lang/crates.io-index/master/';

  getIndexSuffix(lookupName: string): string {
    const len = lookupName.length;

    if (len === 1) {
      return '1/' + lookupName;
    }
    if (len === 2) {
      return '2/' + lookupName;
    }
    if (len === 3) {
      return '3/' + lookupName[0] + '/' + lookupName;
    }

    return (
      lookupName.slice(0, 2) + '/' + lookupName.slice(2, 4) + '/' + lookupName
    );
  }

  // this.handleErrors will always throw
  // eslint-disable-next-line consistent-return
  async getReleases({
    lookupName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const cacheNamespace = 'datasource-crate';
    const cacheKey = lookupName;
    const cachedResult = await packageCache.get<ReleaseResult>(
      cacheNamespace,
      cacheKey
    );
    // istanbul ignore if
    if (cachedResult) {
      return cachedResult;
    }
    const crateUrl = this.BASE_URL + this.getIndexSuffix(lookupName);
    const dependencyUrl = `https://crates.io/crates/${lookupName}`;
    try {
      const lines = (await this.http.get(crateUrl)).body
        .split('\n') // break into lines
        .map((line) => line.trim()) // remove whitespace
        .filter((line) => line.length !== 0) // remove empty lines
        .map((line) => JSON.parse(line) as CrateRecord); // parse
      const result: ReleaseResult = {
        dependencyUrl,
        releases: [],
      };
      result.releases = lines
        .map((version: { vers: string; yanked: boolean }) => {
          const release: Release = {
            version: version.vers,
          };
          if (version.yanked) {
            release.isDeprecated = true;
          }
          return release;
        })
        .filter((release) => release.version);
      if (!result.releases.length) {
        return null;
      }
      const cacheMinutes = 10;
      await packageCache.set(cacheNamespace, cacheKey, result, cacheMinutes);
      return result;
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }
}
