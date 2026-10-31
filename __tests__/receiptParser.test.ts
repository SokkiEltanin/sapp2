import { getFoodTags, categorizeFoodSubcat, parseReceiptText } from '@/utils/receiptParser';
import { foodSubcat } from '@/utils/food';
import type { ReceiptItem } from '@/types/finances';

// Port z sapp (__tests__/receiptParser.test.ts) — logika parsera jest kategorio-NIEZALEŻNA,
// więc wszystkie testy struktury paragonu (sklep/data/kaucja/rabaty/waga) przechodzą 1:1,
// tylko `products`→`items` i `finalPrice`→`price` (nazwy pól w sapp2's ReceiptItem).
// Pominięte: `categorize()` (funkcja USUNIĘTA — sapp2 nie ma ExpenseCategory, patrz komentarz
// w receiptParser.ts) — te testy w sapp istniały TYLKO żeby pilnować non-food kategoryzacji,
// której sapp2 świadomie nie ma.
const item = (o: Partial<ReceiptItem>): ReceiptItem => ({
  name: 'x', price: 5, quantity: 1, unitPrice: 5, ...o,
});
const subcatFor = (name: string): string => foodSubcat(item({ name, foodSubcat: categorizeFoodSubcat(name) }));

describe('getFoodTags — wykrywanie słodyczy', () => {
  test('klasyki oznaczone jako "słodycze"', () => {
    expect(getFoodTags('Czekolada Milka mleczna')).toContain('słodycze');
    expect(getFoodTags('Baton Snickers 50g')).toContain('słodycze');
    expect(getFoodTags('Ptasie Mleczko waniliowe')).toContain('słodycze');
    expect(getFoodTags('Kinder Bueno')).toContain('słodycze');
  });

  test('zwykłe produkty NIE są słodyczą', () => {
    expect(getFoodTags('Mleko 2%')).not.toContain('słodycze');
    expect(getFoodTags('Chleb razowy')).not.toContain('słodycze');
    expect(getFoodTags('Pierś z kurczaka')).not.toContain('słodycze');
  });

  test('pieczywo trafia do "pieczywo", nie "słodycze"', () => {
    const tags = getFoodTags('Bułka kajzerka');
    expect(tags).toContain('pieczywo');
    expect(tags).not.toContain('słodycze');
  });

  test('mocno skrócone "Ciast" (bez "k", jak na realnych paragonach) też łapie się jako słodycze', () => {
    expect(getFoodTags('ŁowiczDesRyżKruCiastŚliw100g')).toContain('słodycze');
  });
  test('marki/nazwy dopisane po realnym audycie danych: Balconi, Jelly, miętówki, grylaż', () => {
    expect(getFoodTags('Balconi Mix max')).toContain('słodycze');
    expect(getFoodTags('Owolovo Jelly')).toContain('słodycze');
    expect(getFoodTags('Miętówki MountainHills')).toContain('słodycze');
    expect(getFoodTags('Grylaż kukurydza 62g')).toContain('słodycze');
  });
  test('"mieszanka studencka" (trail mix) łapie się jako przekąski', () => {
    expect(getFoodTags('Mieszanka studencka 200g')).toContain('przekąski');
  });
});

describe('getFoodTags — krótkie trzony nie łapią się w środku niepowiązanych słów', () => {
  test('"ser" nie łapie się w środku słowa (laser, reserved, bokserki)', () => {
    expect(getFoodTags('Laser do włosów')).not.toContain('nabiał');
    expect(getFoodTags('Reserved bluza')).not.toContain('nabiał');
    expect(getFoodTags('Bokserki męskie')).not.toContain('nabiał');
  });
  test('"por" nie łapie się w środku słowa (sport, emporio)', () => {
    expect(getFoodTags('Sprzęt sportowy')).not.toContain('warzywa');
    expect(getFoodTags('Emporio Armani')).not.toContain('warzywa');
  });
  test('"tost" nie łapie się w Autostrada', () => {
    expect(getFoodTags('Autostrada A1')).not.toContain('pieczywo');
  });
  test('"lays" nie łapie się w PlayStation', () => {
    expect(getFoodTags('PlayStation Plus')).not.toContain('przekąski');
  });
  test('"rum"/"gin" nie łapią się w serum/pyralgina', () => {
    expect(getFoodTags('Serum do twarzy')).not.toContain('napoje');
    expect(getFoodTags('Pyralgina 10 tabletek')).not.toContain('napoje');
  });
  test('"ser" dalej łapie prawdziwy nabiał mimo końcówki fleksyjnej (serek, sery)', () => {
    expect(getFoodTags('Serek wiejski')).toContain('nabiał');
    expect(getFoodTags('Sery żółte plastry')).toContain('nabiał');
  });
});

const LIDL_RECEIPT_WITH_DEPOSIT = `
Adres siedziby: Poznańska 48, Jankowice
             62-080 Tarnowo
Podgórne nr rej: BDO 000002265 Lidl sp.
             z o. o. sp. k.
84-120 Władysławowo, ul. Starowiejska 25
2026-08-20

Kinder Crispy 5-pak
                     1 * 15.99 15.99 C
   RABAT 50%                   -8,00
Lay's Chipsy Oven B.
                       1 * 9.49 9.49 C
   RABAT 50%                   -4,75
Przekąska kebab drob
                       2 * 3.47 6.94 C
APAP tabletki
                       1 * 9.99 9.99 B
PTU B                             9,99
Kwota B 8,00%                     0,74
PTU C                            19,67
Kwota C 5,00%                     0,94
Suma                              1,68
Suma PLN            29,66
86 1403      nr:   109457        11:35
Opakowania zwrotne przyjęcia
   Zwrot kaucji           1 * 6.0 -6.0
Opakowania zwrotne suma          -6,00
Suma                    23,66
Płatność         Karta płatnicza 23,66
`;

const KAUFLAND_RECEIPT_COPY = `
&1Kaufland Polska Markety Sp.z o.o.Sp.j.
&8Al.Armii Krajowej 47, 50-541 Wrocław&8
Nr BDO 000013346
&5ul. Rejtana&5 &640&6
&235-959&2  &3Rzeszów&3 5464
Cena PLN
Beauty / Zdrowie / Dziecko
BevolaPomadkaRose4,8g             4,99 A
Czas wolny/Do czytania/aktywny wypocz.
Papier ksero                     19,99 A
teczka a4 pastel
 4 * 3,99                        15,96 A
Teczka A4        2 * 3,99         7,98 A
Drogeria/Gosp.dom/Karmy dla zwierz/Tytoń
VizirProszekDoPrania3,465kg      49,99 A
Somat Kaps.DoZmyw.60             44,99 A
CifSpray435ml                    19,99 B
CifSprayTłuszcz750ml             19,99 A
Lada z obsługą
MakrelaWędz.luz.
 0,204 KG                         6,10 C
Owoce/Warzywa/Kwiaty
Kiwi szt         4 * 1,99         7,96 C
Suma cząstkowa        197,94

----------------Promocja---------------
Cena z kartą                    -12,00
Pozycje:7,8
Kup 2 płać za 1                 -11,97
Pozycje:3,4
Kupon XTRA                       -2,00
Pozycje:10
Rabat                           -12,00
Pozycje:2
Suma                            159,97
Płatność kartą                  159,97
Reszta                            0,00

Vat %       Brutto     Netto       VAT
A=23,00%    133,92    108,88     25,04
B=8,00%      13,99     12,95      1,04
C=5,00%      12,06     11,49      0,57
`;

describe('parseReceiptText — Kaufland app "Receipt copy"', () => {
  test('sklep i finalna, po-rabatowa kwota', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    expect(r.storeName).toBe('Kaufland');
    expect(r.total).toBe(159.97);
  });

  test('subtotal (suma price PO alokacji rabatów) zgadza się z total — nie 197,94 przed rabatami', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    expect(r.subtotal).toBeCloseTo(159.97, 2);
    expect(r.subtotal).toBeCloseTo(r.total, 2);
    expect(r.totalDiscount).toBeCloseTo(37.97, 2);
  });

  test('łapie wszystkie 10 pozycji, pomijając nagłówki kategorii ("Lada z obsługą" itd.)', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    expect(r.items).toHaveLength(10);
    expect(r.items.some(p => /lada z obs/i.test(p.name) || /beauty/i.test(p.name) || /owoce/i.test(p.name))).toBe(false);
  });

  test('multi-buy na dwóch liniach — qty/unitPrice z paragonu, price PO rabacie "Kup 2 płać za 1"', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    const p = r.items.find(x => /teczka a4 pastel/i.test(x.name));
    expect(p).toBeDefined();
    expect(p!.quantity).toBe(4);
    expect(p!.unitPrice).toBe(3.99);
    expect(p!.price).toBe(7.98);
    expect(p!.promotion).toBe('Kup 2 płać za 1');
  });

  test('multi-buy w jednej linii — price PO tym samym rabacie', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    const p = r.items.find(x => /^Teczka a4$/i.test(x.name));
    expect(p).toBeDefined();
    expect(p!.quantity).toBe(2);
    expect(p!.price).toBe(3.99);
  });

  test('towar luzem na wagę — bez rabatu, nikt się do niego nie odwołuje', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    const p = r.items.find(x => /makrela/i.test(x.name));
    expect(p).toBeDefined();
    expect(p!.quantity).toBeCloseTo(0.204, 3);
    expect(p!.price).toBe(6.10);
    expect(p!.promotion).toBeUndefined();
  });

  test('proste pozycje "nazwa ... cena litera" w jednej linii, bez rabatu (Bevola, Somat)', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    expect(r.items.find(p => /bevolapomadka/i.test(p.name))?.price).toBe(4.99);
    expect(r.items.find(p => /somat/i.test(p.name))?.price).toBe(44.99);
  });

  test('rabat na JEDNEJ pozycji ("Rabat -12,00" → Pozycje:2, "Papier ksero")', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    const p = r.items.find(x => /papier ksero/i.test(x.name));
    expect(p).toBeDefined();
    expect(p!.price).toBe(7.99);
    expect(p!.discount).toBe(12);
    expect(p!.promotion).toBe('Rabat');
  });

  test('rabat rozłożony na DWIE pozycje po równo', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    const a = r.items.find(x => /cifspray435/i.test(x.name));
    const b = r.items.find(x => /cifspraytłuszcz/i.test(x.name));
    expect(a?.price).toBe(13.99);
    expect(b?.price).toBe(13.99);
    expect((a?.discount ?? 0) + (b?.discount ?? 0)).toBeCloseTo(12, 2);
  });

  test('kupon na pojedynczej pozycji ("Kupon XTRA -2,00" → Pozycje:10, "Kiwi szt")', () => {
    const r = parseReceiptText(KAUFLAND_RECEIPT_COPY);
    const p = r.items.find(x => /kiwi/i.test(x.name));
    expect(p?.price).toBe(5.96);
    expect(p?.promotion).toBe('Kupon XTRA');
  });
});

const KAUFLAND_PRINTED_RECEIPT = `
Kaufland Polska Markety Sp.z o.o.Sp.j.
Al.Armii Krajowej 47, 50-541 Wrocław
Nr BDO 000013346
ul. Rejtana 40
35-959  Rzeszów 5464
Cena PLN
Piekarnia
Bułka orkiszowa 90g
 4 * 1,49                         5,96 C
Bułka pszenno-żytnia 80g
 4 * 0,99                         3,96 C
Podstawowe artykuły spożywcze
KotlinKetchupZPiekła450G
 2 * 4,99                         9,98 B
Słodycze
MilkaCiastkaSens156g
 2 * 6,49                        12,98 C
Suma                             32,88
Płatność kartą                   32,88
Reszta                            0,00
`;

describe('parseReceiptText — Kaufland DRUKOWANY paragon, "Suma" zamiast "Suma cząstkowa"', () => {
  test('łapie wszystkie 4 pozycje zamiast "Brak produktów"', () => {
    const r = parseReceiptText(KAUFLAND_PRINTED_RECEIPT);
    expect(r.items).toHaveLength(4);
  });

  test('ilość/cena jednostkowa/cena finalna poprawnie odczytane z linii kontynuacji', () => {
    const r = parseReceiptText(KAUFLAND_PRINTED_RECEIPT);
    const p = r.items.find(x => /bułka orkiszowa/i.test(x.name));
    expect(p).toBeDefined();
    expect(p!.quantity).toBe(4);
    expect(p!.unitPrice).toBe(1.49);
    expect(p!.price).toBe(5.96);
  });

  test('nagłówki kategorii ("Piekarnia"/"Słodycze"/...) nie trafiają jako produkty', () => {
    const r = parseReceiptText(KAUFLAND_PRINTED_RECEIPT);
    expect(r.items.some(p => /^piekarnia$/i.test(p.name) || /^słodycze$/i.test(p.name))).toBe(false);
  });

  test('total = kwota z "Płatność kartą" (32,88)', () => {
    const r = parseReceiptText(KAUFLAND_PRINTED_RECEIPT);
    expect(r.total).toBe(32.88);
    expect(r.subtotal).toBeCloseTo(32.88, 2);
  });
});

describe('parseReceiptText — Lidl paragon ze zwrotem kaucji', () => {
  test('"Razem" to finalna, po-kaucyjna kwota (23,66), nie "SUMA PLN" sprzed zwrotu (29,66)', () => {
    const r = parseReceiptText(LIDL_RECEIPT_WITH_DEPOSIT);
    expect(r.total).toBe(23.66);
  });

  test('zwrot kaucji trafia do pozycji jako "deposit" z ujemną ceną', () => {
    const r = parseReceiptText(LIDL_RECEIPT_WITH_DEPOSIT);
    const deposit = r.items.find(p => p.kind === 'deposit');
    expect(deposit).toBeDefined();
    expect(deposit!.price).toBe(-6);
  });

  test('suma pozycji (subtotal) zgadza się z realnie zapłaconą kwotą (total)', () => {
    const r = parseReceiptText(LIDL_RECEIPT_WITH_DEPOSIT);
    expect(r.subtotal).toBeCloseTo(r.total, 2);
  });
});

const LIDL_RECEIPT_WITH_DEPOSIT_CHARGE = `
Adres siedziby: Poznańska 48, Jankowice
             62-080 Tarnowo
Podgórne nr rej: BDO 000002265 Lidl sp.
             z o.o. sp.k.
   ul. Podwisłocze 13, 35-309 Rzeszów
2026-10-09

Papryka czerwona luz
                0,466kg x 14.99 6.99 C
   KDR                         -0,70
Bułka z kiełkami
                        4 * 1.45 5.8 C
   Taniej za 2                 -0,60
   KDR                         -0,52
Mus ow.20g białkaWPC
                       1 * 4.99 4.99 C
   KDR                         -0,50
Bułka ziemn.z ziarn.
                       4 * 1.14 4.56 C
   Taniej za 4                 -0,32
   KDR                         -0,44
Smoothie owsiane.
                       1 * 3.69 3.69 C
   Taniej za 2                 -0,37
Smoothie owsiane.
                       1 * 3.69 3.69 C
   Taniej za 2                 -0,37
Smoothie owsiane.
                       1 * 3.69 3.69 C
   Taniej za 2                 -0,37
Smoothie owsiane.
                       1 * 3.69 3.69 C
   Taniej za 2                 -0,37
Wł. Serek Wiejski
                       1 * 2.39 2.39 C
PTU C                            34,93
Kwota C 5,00%                     1,66
Suma                              1,66
Suma PLN            34,93
85 1688      nr:   132127        18:23
Opakowania zwrotne wydania
   Kaucja PET              1 * 0.5 0.5
   Kaucja PET              1 * 0.5 0.5
   Kaucja PET              1 * 0.5 0.5
   Kaucja PET              1 * 0.5 0.5
Opakowania zwrotne suma           2,00
Suma                    36,93
Płatność         Karta płatnicza 36,93
`;

describe('parseReceiptText — Lidl paragon z opłatą kaucji "wydania"', () => {
  test('4× "Kaucja PET" trafia do pozycji jako 4 "deposit" po 0,50 zł', () => {
    const r = parseReceiptText(LIDL_RECEIPT_WITH_DEPOSIT_CHARGE);
    const deposits = r.items.filter(p => p.kind === 'deposit');
    expect(deposits.length).toBe(4);
    expect(deposits.every(d => d.price === 0.5)).toBe(true);
  });

  test('suma pozycji (subtotal) zgadza się z kwotą na paragonie (36,93), nie 34,93', () => {
    const r = parseReceiptText(LIDL_RECEIPT_WITH_DEPOSIT_CHARGE);
    expect(r.total).toBe(36.93);
    expect(r.subtotal).toBeCloseTo(36.93, 2);
  });
});

describe('getFoodTags/foodSubcat — 8 kategorii spiżarniowych + "sosy"', () => {
  test('nowe samodzielne kategorie', () => {
    expect(subcatFor('Jajka M 10szt')).toBe('jajka');
    expect(subcatFor('Makaron spaghetti 500g')).toBe('makarony');
    expect(subcatFor('Ryż jaśminowy')).toBe('ryż i kasze');
    expect(subcatFor('Kasza gryczana')).toBe('ryż i kasze');
    expect(subcatFor('Mąka pszenna typ 500')).toBe('mąka i produkty sypkie');
    expect(subcatFor('Olej rzepakowy')).toBe('oleje i tłuszcze');
    expect(subcatFor('Oliwa z oliwek extra virgin')).toBe('oleje i tłuszcze');
    expect(subcatFor('Pieprz czarny mielony')).toBe('przyprawy');
  });

  test('"sosy" realnie łapie (ketchup/majonez), wygrywa nad warzywem w nazwie', () => {
    expect(subcatFor('Ketchup łagodny')).toBe('sosy');
    expect(subcatFor('Majonez dekoracyjny')).toBe('sosy');
    expect(subcatFor('Sos pomidorowy 500ml')).toBe('sosy');
  });

  test('kategorie "stanu przetworzenia" (sosy/konserwy/przetwory) wygrywają nad surowym składnikiem w nazwie', () => {
    expect(subcatFor('Dżem truskawkowy')).toBe('konserwy i przetwory');
    expect(subcatFor('Ogórki konserwowe')).toBe('konserwy i przetwory');
    expect(subcatFor('Kapusta kiszona')).toBe('konserwy i przetwory');
  });

  test('mrożonki — fallback TYLKO gdy nic bardziej konkretnego nie pasuje', () => {
    expect(subcatFor('Mieszanka warzyw mrożonych')).toBe('mrożonki');
    expect(subcatFor('Mrożony łosoś filet')).toBe('ryby');
    expect(subcatFor('Pizza mrożona Ristorante')).toBe('dania gotowe');
  });

  test('jajka wydzielone z nabiału, istniejące dopasowania nabiału nietknięte', () => {
    expect(subcatFor('Jajka wiejskie L')).toBe('jajka');
    expect(subcatFor('Serek wiejski')).toBe('nabiał');
    expect(subcatFor('Mleko 2%')).toBe('nabiał');
  });

  test('znana granica: "Przyprawa do X" z nazwą mięsa w środku łapie się jako mięso, nie przyprawy', () => {
    expect(subcatFor('Przyprawa do kurczaka')).toBe('mięso');
    expect(subcatFor('Pieprzowa kiełbasa')).toBe('mięso');
  });
});
