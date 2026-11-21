import { desktopLayout, visibleTabs, tabFromPath, isDesktopPanelPath, DESKTOP_COL_MAX } from '../src/utils/desktopColumns';

describe('desktopLayout', () => {
  it('wąskie okno = układ telefonu', () => { expect(desktopLayout(800)).toBeNull(); });
  it('1920 px mieści 4 kolumny', () => {
    const l = desktopLayout(1920)!;
    expect(l.cols).toBe(4);
    expect(l.colW).toBeLessThanOrEqual(DESKTOP_COL_MAX);
    expect(l.colW).toBeGreaterThanOrEqual(400);
  });
  it('1366 px — 3 kolumny, 1100 px — 2', () => {
    expect(desktopLayout(1366)!.cols).toBe(3);
    expect(desktopLayout(1100)!.cols).toBe(2);
  });
});

describe('visibleTabs', () => {
  it('4 kolumny = wszystko', () => { expect(visibleTabs(4, 'daily')).toEqual(['index', 'finances', 'tasks', 'daily']); });
  it('ostatnia kolumna pokazuje wybraną zakładkę', () => {
    expect(visibleTabs(3, 'index')).toEqual(['index', 'finances', 'tasks']);
    expect(visibleTabs(3, 'daily')).toEqual(['index', 'finances', 'daily']);
    expect(visibleTabs(2, 'tasks')).toEqual(['index', 'tasks']);
  });
});

describe('tabFromPath', () => {
  it('rozpoznaje zakładki', () => {
    expect(tabFromPath('/')).toBe('index');
    expect(tabFromPath('/finances')).toBe('finances');
    expect(tabFromPath('/tasks?task=1')).toBe('tasks');
    expect(tabFromPath('/settings')).toBeNull();
  });
});

describe('isDesktopPanelPath', () => {
  it('panel dla ekranów spoza zakładek', () => {
    expect(isDesktopPanelPath('/settings')).toBe(true);
    expect(isDesktopPanelPath('/note')).toBe(true);
    expect(isDesktopPanelPath('/')).toBe(false);
    expect(isDesktopPanelPath('/tasks')).toBe(false);
    expect(isDesktopPanelPath('/login')).toBe(false);
  });
});

describe('szerokość panelu na komputerze', () => {
  const { deskPanelWidth } = require('../src/utils/desktopColumns');
  it('notatka szersza, przyciemnienie liczone z tej samej szerokości', () => {
    expect(deskPanelWidth('note', 1600, 560)).toBe(880);
    expect(deskPanelWidth('/note?id=1', 1600, 560)).toBe(880);
    expect(deskPanelWidth('/note', 2400, 560)).toBe(900);
    expect(deskPanelWidth('settings', 1600, 560)).toBe(560);
    expect(deskPanelWidth('/note', 500, 560)).toBe(500);
  });
});
