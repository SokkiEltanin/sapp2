import { shortcutFor, type KeyInfo } from '../src/utils/desktopShortcuts';

const k = (key: string, p: Partial<KeyInfo> = {}): KeyInfo => ({ key, ctrl: false, meta: false, alt: false, typing: false, ...p });

describe('shortcutFor', () => {
  it('cyfry przełączają zakładki', () => {
    expect(shortcutFor(k('1'))).toEqual({ kind: 'go', href: '/' });
    expect(shortcutFor(k('3'))).toEqual({ kind: 'go', href: '/tasks' });
    expect(shortcutFor(k('5'))).toBeNull();
  });
  it('szukanie: / oraz Ctrl+K (także w trakcie pisania)', () => {
    expect(shortcutFor(k('/'))).toEqual({ kind: 'go', href: '/search' });
    expect(shortcutFor(k('k', { ctrl: true, typing: true }))).toEqual({ kind: 'go', href: '/search' });
  });
  it('podczas pisania nic nie przechwytuje', () => {
    expect(shortcutFor(k('1', { typing: true }))).toBeNull();
    expect(shortcutFor(k('n', { typing: true }))).toBeNull();
    expect(shortcutFor(k('Escape', { typing: true }))).toBeNull();
  });
  it('nie łapie skrótów przeglądarki', () => {
    expect(shortcutFor(k('1', { ctrl: true }))).toBeNull();
    expect(shortcutFor(k('n', { meta: true }))).toBeNull();
  });
  it('Esc = wstecz, N = notatki, przecinek = ustawienia', () => {
    expect(shortcutFor(k('Escape'))).toEqual({ kind: 'back' });
    expect(shortcutFor(k('N'))).toEqual({ kind: 'go', href: '/notes' });
    expect(shortcutFor(k(','))).toEqual({ kind: 'go', href: '/settings' });
  });
});
