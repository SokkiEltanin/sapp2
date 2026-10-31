import {
  normalizeProductName, productGroupKey, productGroupLabel, productNameSimilarity,
  canonicalProductName, brandFoodSubcat, parseWeightFromName, priceAnomaly, suggestSimilarName,
  type PriceStat,
} from '@/utils/productMemory';

// Port z sapp (__tests__/productMemory.test.ts) 1:1 dla funkcji które sapp2 faktycznie
// portuje (kategorio-niezależne: fuzzy-matching/grupowanie/aliasy/waga/cena). Pominięte:
// `allKnownTags`/`tagsMatchingWords`/`allKnownSubTags` — wiązały się z sapp's pamięcią
// tagów PER PRODUKT, której sapp2 nie ma (tagi żyją na poziomie całego wydatku, patrz
// komentarz w productMemory.ts). `brandTag` → `brandFoodSubcat` (zmiana nazwy, ta sama
// logika — zwraca podkategorię jedzenia, nie sztywną kategorię).
describe('productMemory — normalizeProductName', () => {
  test('lowercase, polskie znaki, interpunkcja → spacja, zbite spacje', () => {
    expect(normalizeProductName('Żółta Cebula!')).toBe('zolta cebula');
    expect(normalizeProductName('  Ser,  Gouda  ')).toBe('ser gouda');
  });
  test('cyfry zostają (rozmiary mają znaczenie dla identyczności produktu)', () => {
    expect(normalizeProductName('Woda 1.5l')).toBe('woda 1 5l');
  });
});

describe('productMemory — productGroupKey / productGroupLabel', () => {
  test('grupa = pierwszy token PO odfiltrowaniu qualifierów (lekki/bio/eko...)', () => {
    expect(productGroupKey('Serek wiejski lekki')).toBe('serek');
    expect(productGroupKey('Serek wiejski Pilos')).toBe('serek');
  });
  test('gdy WSZYSTKIE tokeny są qualifierami → fallback do pełnej znormalizowanej nazwy', () => {
    expect(productGroupKey('Bio Eko')).toBe('bio eko');
  });

  test('label dla wielu nazw = najdłuższy wspólny prefiks tokenów (z najkrótszej nazwy)', () => {
    expect(productGroupLabel(['Bułka kajzerka', 'Bułka grahamka'])).toBe('Bułka');
  });
  test('label dla JEDNEJ nazwy = cała nazwa po filtrze qualifierów', () => {
    expect(productGroupLabel(['Ser żółty'])).toBe('Ser żółty');
  });
  test('pusta lista → pusty string', () => {
    expect(productGroupLabel([])).toBe('');
  });
});

describe('productMemory — productNameSimilarity (trigram)', () => {
  test('identyczne (po normalizacji) → 1', () => {
    expect(productNameSimilarity('Mleko 2%', 'mleko 2%')).toBe(1);
  });
  test('literówka bliżej niż zupełnie inny produkt', () => {
    const typo = productNameSimilarity('Pomidory malinowe', 'Pomidory malionwe');
    const unrelated = productNameSimilarity('Pomidory malinowe', 'Proszek do prania');
    expect(typo).toBeGreaterThan(unrelated);
    expect(typo).toBeGreaterThan(0.7);
  });
  test('bardzo krótkie stringi (<2 znaki) → 0, nie wybuch', () => {
    expect(productNameSimilarity('a', 'ab')).toBe(0);
  });
});

describe('productMemory — canonicalProductName', () => {
  test('nauczony alias (dokładne dopasowanie) wygrywa najpierw', () => {
    expect(canonicalProductName('mleko 2%', { 'mleko 2': 'Mleko Łaciate 2%' })).toBe('Mleko Łaciate 2%');
  });
  test('rozpoznana marka jako osobne słowo — składa warianty do jednej nazwy', () => {
    expect(canonicalProductName('jezyki cherry', {})).toBe('Jeżyki');
  });
  test('rozpoznana marka sklejona przez OCR (bez spacji) — dopasowanie po prefiksie', () => {
    expect(canonicalProductName('jezykicherry', {})).toBe('Jeżyki');
  });
  test('nierozpoznana nazwa bez aliasu → zwraca oryginał (trim)', () => {
    expect(canonicalProductName('  Zupełnie nowy produkt  ', {})).toBe('Zupełnie nowy produkt');
  });
});

describe('productMemory — brandFoodSubcat', () => {
  test('marka → podkategoria jedzenia', () => {
    expect(brandFoodSubcat("Lay's Paprica")).toBe('przekąski');
    expect(brandFoodSubcat('Coca-Cola 2l')).toBe('napoje');
  });
  test('etykieta sklepowa → podkategoria', () => {
    expect(brandFoodSubcat('Pikok szynka')).toBe('mięso');
  });
  test('nierozpoznane → undefined', () => {
    expect(brandFoodSubcat('zupelnie nieznany produkt')).toBeUndefined();
  });
});

describe('productMemory — parseWeightFromName', () => {
  test('proste gramy/kg/litry z paragonu', () => {
    expect(parseWeightFromName('Ogórki 700g')).toBe(0.7);
    expect(parseWeightFromName('Ser Gouda 0,5 kg')).toBe(0.5);
    expect(parseWeightFromName('Woda 1,5l')).toBe(1.5);
  });
  test('paczka z mnożnikiem (COUNT x SIZE UNIT)', () => {
    expect(parseWeightFromName('Chipsy 6x40g')).toBe(0.24);
  });
  test('brak wagi w nazwie → undefined', () => {
    expect(parseWeightFromName('Chleb żytni')).toBeUndefined();
    expect(parseWeightFromName('')).toBeUndefined();
  });
  test('sama liczba bez jednostki (ilość, nie waga) → undefined', () => {
    expect(parseWeightFromName('Paluszki 5')).toBeUndefined();
  });
  test('absurdalna wartość (>50kg) odrzucona jako OCR-śmieć', () => {
    expect(parseWeightFromName('Coś 90000g')).toBeUndefined();
  });
});

describe('productMemory — priceAnomaly', () => {
  const stat = (o: Partial<PriceStat>): PriceStat => ({ n: 5, mean: 10, min: 8, max: 12, last: 10, ...o });

  test('brak statystyk lub za mało próbek (<3) → null', () => {
    expect(priceAnomaly(50, undefined)).toBeNull();
    expect(priceAnomaly(50, stat({ n: 2 }))).toBeNull();
  });
  test('normalna cena w okolicach historii → null', () => {
    expect(priceAnomaly(11, stat({}))).toBeNull();
  });
  test('wysoki STOSUNEK ale mały gap bezwzględny (<5 zł) → null (oba warunki muszą być spełnione)', () => {
    expect(priceAnomaly(5, stat({ max: 2, mean: 1.5 }))).toBeNull();
  });
  test('stosunek >2.5x ORAZ gap >=5 zł → oznaczone jako high', () => {
    expect(priceAnomaly(35, stat({ max: 12, mean: 10 }))).toEqual({ kind: 'high', typical: 10 });
  });
  test('niska (promocyjna) cena nigdy nie jest oznaczana', () => {
    expect(priceAnomaly(3, stat({ max: 12, mean: 10 }))).toBeNull();
  });
});

describe('productMemory — suggestSimilarName', () => {
  test('sugeruje znaną nazwę w paśmie niepewności (blisko, ale nie na tyle by auto-scalić)', () => {
    const known = ['Pomidor koktajlowy', 'Proszek do prania'];
    expect(suggestSimilarName('Pomidor malinowy', known)).toBe('Pomidor koktajlowy');
  });
  test('dokładne dopasowanie (po normalizacji) → null', () => {
    expect(suggestSimilarName('jogurt naturalny bakoma', ['Jogurt naturalny Bakoma'])).toBeNull();
  });
  test('nic wystarczająco bliskiego → null', () => {
    expect(suggestSimilarName('Zupełnie inny produkt', ['Jogurt naturalny Bakoma'])).toBeNull();
  });
});
