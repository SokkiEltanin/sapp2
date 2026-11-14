import { buildFromTag, apkFromRelease } from '@/utils/appVersion';

describe('aktualizacje — nowy APK z GitHub Releases', () => {
  const rel = (tag: string, assets: any[] = [{ name: 'sapp2-build200-v0.1.0-abc.apk', browser_download_url: 'https://x/a.apk' }]) =>
    ({ tag_name: tag, html_url: 'https://x/rel', assets });

  it('numer z tagu', () => {
    expect(buildFromTag('build-187')).toBe(187);
    expect(buildFromTag('v1.0')).toBeNull();
    expect(buildFromTag(undefined)).toBeNull();
  });

  it('nowszy release → link do pliku APK', () => {
    expect(apkFromRelease(rel('build-200'), 190)).toEqual({ build: 200, url: 'https://x/a.apk' });
  });

  it('ten sam albo starszy (np. po OTA numer z bundla jest wyższy) → nic', () => {
    expect(apkFromRelease(rel('build-200'), 200)).toBeNull();
    expect(apkFromRelease(rel('build-200'), 205)).toBeNull();
  });

  it('dev build (brak numeru) nigdy nie nagabuje', () => {
    expect(apkFromRelease(rel('build-200'), null)).toBeNull();
  });

  it('bez pliku APK → strona release', () => {
    expect(apkFromRelease(rel('build-201', []), 190)).toEqual({ build: 201, url: 'https://x/rel' });
  });
});
