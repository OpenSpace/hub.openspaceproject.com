// Where to read each license. The names don't say which version, so these point at the
// current one (CC 4.0, GPL/LGPL 3.0, BSD 3-clause). Licenses not listed here (e.g. new ones
// added in site-config, or Proprietary) have no link
const LICENSE_URLS: Record<string, string> = {
  'CC BY': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-SA': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'CC BY-NC': 'https://creativecommons.org/licenses/by-nc/4.0/',
  'CC BY-NC-SA': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  'CC BY-ND': 'https://creativecommons.org/licenses/by-nd/4.0/',
  'CC BY-NC-ND': 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
  CC0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  MIT: 'https://opensource.org/license/mit',
  Apache: 'https://www.apache.org/licenses/LICENSE-2.0',
  GPL: 'https://www.gnu.org/licenses/gpl-3.0.html',
  LGPL: 'https://www.gnu.org/licenses/lgpl-3.0.html',
  BSD: 'https://opensource.org/license/bsd-3-clause',
};

export const getLicenseUrl = (license: string | null | undefined): string | undefined =>
  license ? LICENSE_URLS[license.trim()] : undefined;
