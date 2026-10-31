import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveMerchant, recordMerchantAccept, merchantFor, loadMerchantMemory,
  merchantIsAuto, setMerchantAuto, guessTags, AUTO_THRESHOLD,
} from '@/utils/merchantMemory';

// Port z sapp (__tests__/merchantMemory.test.ts), PRZEPISANY pod `tags: string[]`
// zamiast sapp's `category: ExpenseCategory` (patrz komentarz w merchantMemory.ts) —
// mechanika zaufania/auto-akceptacji bez zmian, `guessCategory` → `guessTags`.
// Pominięte: `saveMerchantTags` (w sapp to było DRUGIE pole obok category — w sapp2
// tagi SĄ już głównym polem, więc ta funkcja nie ma odpowiednika, `saveMerchant`
// robi to samo).
beforeEach(async () => { await AsyncStorage.clear(); });

describe('merchantMemory — guessTags (pierwsza zgadywanka przed nauczeniem się)', () => {
  test('rozpoznaje sklepy po kilku grupach, bez rozróżniania wielkości liter', () => {
    expect(guessTags('LIDL Hetmańska')).toEqual(['Jedzenie']);
    expect(guessTags('orlen stacja 123')).toEqual(['Transport']);
    expect(guessTags('Rossmann')).toEqual(['Zdrowie']);
    expect(guessTags('Zara')).toEqual(['Odzież']);
    expect(guessTags('IKEA Kraków')).toEqual(['Dom']);
  });
  test('polskie i beznakreślkowe warianty tej samej sieci trafiają w to samo (żabka/zabka)', () => {
    expect(guessTags('Żabka Nano')).toEqual(['Jedzenie']);
    expect(guessTags('Zabka Express')).toEqual(['Jedzenie']);
  });
  test('nierozpoznany sklep → pusta lista (bez fałszywej podpowiedzi)', () => {
    expect(guessTags('Zupełnie nieznany sklep xyz')).toEqual([]);
  });
  test('"dino" (spożywczak) nie koliduje z "kino" (rozrywka) mimo wspólnego podciągu liter', () => {
    expect(guessTags('Dino Polska')).toEqual(['Jedzenie']);
  });
});

describe('merchantMemory — saveMerchant (zapis BEZ ruszania liczników zaufania)', () => {
  test('pierwszy zapis tworzy wpis z tagami', async () => {
    await saveMerchant('Lidl', { tags: ['Jedzenie'] });
    const mem = await loadMerchantMemory();
    expect(mem['lidl'].tags).toEqual(['Jedzenie']);
  });
  test('storeKey normalizowany (trim + lowercase) tak samo przy zapisie i przy odczycie', async () => {
    await saveMerchant('  Lidl  ', { tags: ['Jedzenie'] });
    const mem = await loadMerchantMemory();
    expect(mem['lidl']).toBeDefined();
    expect(merchantFor('LIDL', mem)).toBeDefined();
    expect(merchantFor('  lidl  ', mem)).toBeDefined();
  });
  test('nadpisanie tagów NIE zeruje wcześniej nabytych cleanAccepts', async () => {
    await recordMerchantAccept('Lidl', { tags: ['Jedzenie'], corrected: false });
    await recordMerchantAccept('Lidl', { tags: ['Jedzenie'], corrected: false });
    await saveMerchant('Lidl', { tags: ['Inne'] });
    const mem = await loadMerchantMemory();
    expect(mem['lidl'].tags).toEqual(['Inne']);
    expect(mem['lidl'].cleanAccepts).toBe(2);
  });
});

describe('merchantMemory — recordMerchantAccept (stopniowe zaufanie do auto-księgowania)', () => {
  test('pierwsza akceptacja (brak historii) → cleanAccepts=1, jeszcze nie auto', async () => {
    const info = await recordMerchantAccept('Lidl', { tags: ['Jedzenie'], corrected: false });
    expect(info?.cleanAccepts).toBe(1);
    expect(info?.auto).toBeFalsy();
  });

  test(`dokładnie AUTO_THRESHOLD(${AUTO_THRESHOLD}) czystych akceptacji z rzędu → graduacja do auto`, async () => {
    let info;
    for (let i = 0; i < AUTO_THRESHOLD - 1; i++) {
      info = await recordMerchantAccept('Lidl', { tags: ['Jedzenie'], corrected: false });
    }
    expect(info?.cleanAccepts).toBe(AUTO_THRESHOLD - 1);
    expect(info?.auto).toBeFalsy();

    info = await recordMerchantAccept('Lidl', { tags: ['Jedzenie'], corrected: false });
    expect(info?.cleanAccepts).toBe(AUTO_THRESHOLD);
    expect(info?.auto).toBe(true);
  });

  test('korekta tagów ZERUJE licznik i cofa auto — musi zasłużyć na zaufanie od nowa', async () => {
    for (let i = 0; i < AUTO_THRESHOLD; i++) {
      await recordMerchantAccept('Lidl', { tags: ['Jedzenie'], corrected: false });
    }
    let mem = await loadMerchantMemory();
    expect(mem['lidl'].auto).toBe(true);

    const info = await recordMerchantAccept('Lidl', { tags: ['Inne'], corrected: true });
    expect(info?.cleanAccepts).toBe(0);
    expect(info?.auto).toBe(false);
    expect(info?.tags).toEqual(['Inne']); // korekta i tak zapisuje nowe tagi
  });

  test('pusty storeKey → undefined, nic nie zapisuje', async () => {
    const info = await recordMerchantAccept('   ', { tags: ['Jedzenie'], corrected: false });
    expect(info).toBeUndefined();
    const mem = await loadMerchantMemory();
    expect(Object.keys(mem).length).toBe(0);
  });
});

describe('merchantMemory — merchantIsAuto / setMerchantAuto', () => {
  test('nieznany sklep → nie auto', async () => {
    expect(await merchantIsAuto('Nieznany')).toBe(false);
  });

  test('ręczne włączenie auto NIE rusza cleanAccepts', async () => {
    await recordMerchantAccept('Lidl', { tags: ['Jedzenie'], corrected: false });
    await setMerchantAuto('Lidl', true);
    const mem = await loadMerchantMemory();
    expect(mem['lidl'].auto).toBe(true);
    expect(mem['lidl'].cleanAccepts).toBe(1);
  });

  test('ręczne wyłączenie auto ZERUJE cleanAccepts (musi zasłużyć od nowa, spójne z korektą)', async () => {
    for (let i = 0; i < AUTO_THRESHOLD; i++) {
      await recordMerchantAccept('Lidl', { tags: ['Jedzenie'], corrected: false });
    }
    await setMerchantAuto('Lidl', false);
    const mem = await loadMerchantMemory();
    expect(mem['lidl'].auto).toBe(false);
    expect(mem['lidl'].cleanAccepts).toBe(0);
  });

  test('włączenie auto dla NIEISTNIEJĄCEGO merchanta jest no-opem (nie tworzy wpisu znikąd)', async () => {
    await setMerchantAuto('Widmo', true);
    const mem = await loadMerchantMemory();
    expect(mem['widmo']).toBeUndefined();
  });
});
