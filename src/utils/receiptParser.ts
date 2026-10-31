import type { ReceiptItem, PaymentMethod } from '@/types/finances';
import { FOOD_SUBCATS } from './food';

// Port z sapp (src/utils/receiptParser.ts) 1:1 dla całej struktury parsowania (detekcja
// sklepu/daty/płatności, rozwijanie skrótów, obsługa rabatów/kaucji/wagi, router
// Kaufland/Biedronka/generic) — to jest kategorio-NIEZALEŻNA logika, żadnych zmian.
// JEDNA realna adaptacja: sapp przypisywał każdej pozycji sztywną `category:
// ExpenseCategory` (groceries/transport/.../other) przez wielki słownik
// CATEGORY_KEYWORDS — sapp2 nie ma tej kategorii (patrz types/finances.ts). Zamiast
// tego pozycja dostaje `foodSubcat` TYLKO gdy rozpozna się jako jedzenie (przez
// FOOD_TAG_MAP, też portowany 1:1 z sapp — to właśnie jest "wyciągnięcie kategorii
// jedzenia z SAPa, żeby przypisywało artykuły"), a nie-jedzeniowe pozycje po prostu
// nie dostają żadnej kategorii — użytkownik ewentualnie doda własny tag na poziomie
// całego wydatku. `CATEGORY_KEYWORDS`/`categorize()`/`groupReceiptByCategory` (sapp's
// non-food dictionary: transport/rozrywka/zdrowie/odzież/mieszkanie/subskrypcje)
// świadomie USUNIĘTE — żadna z tych kategorii nie ma odpowiednika w nowym modelu, a
// to one były źródłem usera pierwotnej frustracji ("ciężko dostosować kategorię").

export interface ParsedReceipt {
  storeName?: string;
  date?: string;   // ISO: YYYY-MM-DD
  items: ReceiptItem[];
  subtotal: number;
  totalDiscount: number;
  total: number;
  paymentMethod: PaymentMethod;   // detected from the receipt; defaults to 'card'
  raw: string;
}

// Card wins if any card/terminal marker is present; else cash only if a cash
// marker shows up; otherwise default to card (most shopping is card).
const CARD_RE = /karta|kart[ąa]\b|p[łl]atno[śs][ćc]\s*(?:kart|bezgot|elektron)|bezgot[óo]wkow|zbli[żz]eniow|visa|mastercard|maestro|\bblik\b|terminal|autoryzacj|p[łl]atno[śs][ćc]\s*mobiln|aps\b|płatność\s*kartą/i;
const CASH_RE = /got[óo]wk|wp[łl]at[ay]\s*got|reszta\b|got[óo]wka\s*pln/i;
export function detectPaymentMethod(text: string): PaymentMethod {
  if (CARD_RE.test(text)) return 'card';
  if (CASH_RE.test(text)) return 'cash';
  return 'card';
}

// ─── Known store brands ───────────────────────────────────────────────────────

const STORE_BRANDS: { pattern: RegExp; name: string }[] = [
  { pattern: /\blidl\b/i,             name: 'Lidl' },
  { pattern: /\bbiedronka\b/i,        name: 'Biedronka' },
  { pattern: /\bkaufland\b/i,         name: 'Kaufland' },
  { pattern: /\bauchan\b/i,           name: 'Auchan' },
  { pattern: /\bcarrefour\b/i,        name: 'Carrefour' },
  { pattern: /\bżabka\b|\bzabka\b/i,  name: 'Żabka' },
  { pattern: /\bnetto\b/i,            name: 'Netto' },
  { pattern: /\bpepco\b/i,            name: 'Pepco' },
  { pattern: /\brossmann?\b/i,        name: 'Rossmann' },
  { pattern: /\bdino\b/i,             name: 'Dino' },
  { pattern: /\bstokrotka\b/i,        name: 'Stokrotka' },
  { pattern: /intermarche\b/i,        name: 'Intermarché' },
  { pattern: /\bpolomarket\b/i,       name: 'Polomarket' },
  { pattern: /\borlen\b/i,            name: 'Orlen' },
  { pattern: /\bbp\b/i,               name: 'BP' },
  { pattern: /\bshell\b/i,            name: 'Shell' },
  { pattern: /mcdonald/i,             name: "McDonald's" },
  { pattern: /\bkfc\b/i,              name: 'KFC' },
  { pattern: /\bsubway\b/i,           name: 'Subway' },
  { pattern: /\baldi\b/i,             name: 'Aldi' },
  { pattern: /\bspar\b/i,             name: 'Spar' },
  { pattern: /\bmakro\b/i,            name: 'Makro' },
  { pattern: /\bselgros\b/i,          name: 'Selgros' },
  { pattern: /\bhebe\b/i,             name: 'Hebe' },
  { pattern: /\bccc\b/i,              name: 'CCC' },
  { pattern: /\bzara\b/i,             name: 'Zara' },
  { pattern: /\breserved\b/i,         name: 'Reserved' },
  { pattern: /\bempik\b/i,            name: 'Empik' },
  { pattern: /\bdecathlon\b/i,        name: 'Decathlon' },
  { pattern: /\bmedia markt\b/i,      name: 'Media Markt' },
  { pattern: /\brtv euro agd\b/i,     name: 'RTV Euro AGD' },
  { pattern: /\bmax electro\b/i,      name: 'Max Electro' },
  { pattern: /\bburger king\b/i,      name: 'Burger King' },
  { pattern: /\bpizza hut\b/i,        name: 'Pizza Hut' },
  { pattern: /\bdomin[o]?'?s\b/i,     name: "Domino's" },
  { pattern: /\bpyszne\b/i,           name: 'Pyszne.pl' },
  { pattern: /\bglovo\b/i,            name: 'Glovo' },
  { pattern: /\bwolt\b/i,             name: 'Wolt' },
  { pattern: /\bstarbucks\b/i,        name: 'Starbucks' },
  { pattern: /\bcosta\b/i,            name: 'Costa Coffee' },
  { pattern: /\bgreen cafe\b/i,       name: 'Green Caffe Nero' },
  { pattern: /\bcinema city\b/i,      name: 'Cinema City' },
  { pattern: /\bmultikino\b/i,        name: 'Multikino' },
  { pattern: /\bhelios\b/i,           name: 'Helios' },
  { pattern: /\bcircle k\b/i,         name: 'Circle K' },
  { pattern: /\blotos\b/i,            name: 'Lotos' },
];

// ─── Food sub-tags (patrz food.ts dla pełnej taksonomii FOOD_SUBCATS/kolorów —
// ten słownik to WYŁĄCZNIE dopasowanie słów-kluczy z nazwy produktu do jednego z
// tych samych tagów) ────────────────────────────────────────────────────────────

const FOOD_TAG_MAP: [string, string[]][] = [
  ['mięso',      [
    'polędwica','schab','szynka','boczek','kiełbas','wędlin','drób','kurczak',
    'indyk','wieprzow','wołow','mielona','pasztet','salami','kabanos','parówk',
    'mortadel','krakowsk','karkówk','golonk','udziec','łopatk','żeberk',
    'prosciutto','chorizo','kaszank','krupniok',
  ]],
  ['nabiał',     [
    'mleko','ser','jogurt','kefir','śmietana','twaróg','masło','śmietank',
    'maślanka','mascarpone','ricotta','brie','camembert','gouda','edam',
    'mozzarella','parmezan','feta','topiony','skyr','cottage',
  ]],
  ['jajka',      ['jaj','jajca','jajko','jajek']],
  ['ryby',       [
    'łosoś','tuńczyk','dorsz','makrela','śledź','anchois','krewetk','pstrąg',
    'tilapia','mintaj','karp','sardynk','halibut','flądra','morszczuk',
    'pangasiu','kawior','małże','kalmary','szprotki','ryba',
  ]],
  ['warzywa',    [
    'ogórek','pomidor','marchew','ziemniak','cebula','papryka','sałat','kapust',
    'brokuł','szpinak','pietruszk','por','kalafior','seler','buraki','rzodkiewk',
    'kukurydza','fasola','groszek','szparagi','dynia','cukinia','bakłażan',
    'bataty','jarmuż','rukola','botwinka','natka','koperek',
  ]],
  ['owoce',      [
    'jabłk','banan','pomarańcz','gruszk','truskawk','malina','winogrono',
    'śliwk','cytryna','mango','kiwi','ananas','arbuz','melon','czereśni',
    'wiśni','morel','brzoskwini','figi','daktyl','borówk','jeżyn','agrest',
    'porzeczk','granat','papaja','awokado','limonka','grejpfrut',
  ]],
  ['słodycze',   [
    'czekolad','czekoladk','cukierek','cukierk','batonik','baton','lody','wafelek','ciast','biszkopty',
    'kinder','kitkat','pralinki','toffi','galaretk','żelki','karmel',
    'ptasie mleczk','michałk','krówk','chałw','miodownik','piernik',
    'snickers','twix','mars','bounty','milky way','raffaello','ferrero',
    'lion','oreo','lotus','delicje','prince polo','prince','wawel','wedel',
    'milka','ritter','lindt','haribo','mentos','lizak','donut','muffin',
    'grześk','grzesk','jeżyk','nutella','krem czekolad','krem orzech','mus czekolad',
    'draż','landrynk','guma do żu','orbit','pianki','marshmallow',
    'sernik','brownie','ptysie','eklerk','faworki','napoleonk','wuzetk',
    'andrut','marcepan','nugat','trufl','deser','pudding','budyń','kisiel','gofr',
    'herbatnik','digestive','petit beurre','bahlsen','leibniz','princessa',
    'merci','celebrations','tic tac','skittles','m&m','smarties','nimm2','chupa',
    'sorbet','markiza','kokosank',
    'miętówk','miętow','balconi','jelly','grylaż','grylaz',
  ]],
  ['pieczywo',   [
    'chleb','bułk','bagietk','tost','graham','pumpernik','orkiszow','rustykalna',
    'żytni','razow','brioche','focaccia','ciabatt','croissant','rogal',
    'drożdżówk','kajzerek','pączek','chałka','sucharki','pieczywo chrup',
  ]],
  ['makarony',   [
    'makaron','spaghetti','penne','fusilli','tagliatelle','tortellini','ravioli',
    'kluski','nitki','świderki','farfalle','linguine','cannelloni','łazank',
  ]],
  ['ryż i kasze', [
    'ryż','kasza','kuskus','kus kus','bulgur','komosa','quinoa',
  ]],
  ['mąka i produkty sypkie', [
    'mąka','cukier','sól','otręby','płatki owsian','musli','muesli','skrobia',
    'drożdż','proszek do piecz','żelatyn',
  ]],
  ['oleje i tłuszcze', [
    'olej','oliwa','smalec','margaryn','tłuszcz',
  ]],
  ['przyprawy',  [
    'przyprawa','przypraw','pieprz','cynamon','wanili','oregano','bazyli',
    'tymianek','kurkuma','majeranek','zioła prowansal','gałka muszkatoł',
    'ziele angielskie','liść laurow','kmin rzymski',
  ]],
  ['napoje',     [
    'woda','sok','piwo','wino','cola','fanta','sprite','pepsi','energy',
    'herbata','kawa','napój','lemoniada','kombucha','smoothie','cydr',
    'gatorade','powerade','red bull','monster','tiger','wódka','whisky',
    'rum','gin','brandy','likier','szampan','prosecco','napój gazow',
  ]],
  ['przekąski',  [
    'chipsy','chips','paluszk','krakers','orzeszk','orzech','migdał','słonecznik','prażynk','prażon',
    'pistacj','popcorn','preczel','precel','nachos','cashew','nerkowc','chrupk','puff','soletti',
    'grzank','grzanki','lays',"lay's",'ovenbaked','oven baked','pringles','doritos','cheetos',
    'crunchips','tortilla chip','star chips','snack','przekąsk','w skor','w skorup','solone',
    'krakelin','wafle ryż','wafle kukurydz','sezamk','flips','bake rolls','bakerolls',
    'talarki','tuc','lajkonik','beskidzkie','monster munch','curly','sun snack',
    'peperami','twist','chrupki kukurydz','pop corn',
    'mieszanka studencka',
  ]],
  ['konserwy i przetwory', [
    'konserw','przetw','dżem','powidł','kompot','marynat','kiszon','passata',
    'koncentrat pomidor',
  ]],
  ['sosy',       [
    'sos','ketchup','majonez','musztard','chrzan','dresing','dressing','pesto',
    'sos sojow','sos worcest','tabasco','sriracha',
  ]],
  ['dania gotowe',['pierogi','naleśnik','pizza mrożon','gotow','zupa gotow',
    'obiad gotow','potrawa gotow','danie gotow','kotlet gotow','lasagna',
    'gnocchi','risotto','paella','tikka masala','curry gotow',
  ]],
  ['mrożonki',   ['mrożon']],
];

const KW_LETTER = 'a-z0-9ąćęłńóśźż';

// getFoodTags celowo łapie SUBSTRING (bez ochrony granic) dla dłuższych trzonów, bo część
// tagów musi łapać obcięte/posklejane przez OCR nazwy bez spacji wcale. Dla KRÓTKICH
// trzonów (<=4 znaki) czysty substring fałszywie łapał się WEWNĄTRZ niepowiązanych słów
// innych kategorii ("ser" w "Serwis samochodowy", "por" w "Sport") — krótkie trzony
// wymagają granicy z LEWEJ strony, prawa strona bez ochrony u wszystkich długości (trzony
// celowo łapią polskie końcówki fleksyjne: "ser"→"serek"/"sery", "jaj"→"jajko"/"jajka").
function foodKeywordHit(lower: string, kw: string): boolean {
  if (kw.length > 4) return lower.includes(kw);
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^${KW_LETTER}])${esc}`, 'i').test(lower);
}

export function getFoodTags(name: string): string[] {
  const lower = name.toLowerCase();
  return FOOD_TAG_MAP
    .filter(([, kws]) => kws.some(kw => foodKeywordHit(lower, kw)))
    .map(([tag]) => tag);
}

// Nazwa może trafić w WIELE tagów naraz (np. "Sos pomidorowy" = warzywa + sosy) —
// rozstrzyga priorytet z FOOD_SUBCATS (food.ts), NIE kolejność w FOOD_TAG_MAP powyżej
// (ta jest tylko zbiorem dopasowań, bez znaczenia porządku). `undefined` = nazwa nie
// czyta się jako jedzenie wcale.
export function categorizeFoodSubcat(name: string): string | undefined {
  const tags = getFoodTags(name);
  if (tags.length === 0) return undefined;
  for (const s of FOOD_SUBCATS) if (tags.includes(s.tag)) return s.tag;
  return undefined;
}

// ─── Promotion detection ──────────────────────────────────────────────────────

function detectPromotion(line: string): string | undefined {
  if (/1\s*\+\s*1/i.test(line)) return '1+1';
  if (/2\s*za\s*cen[ęe]\s*1/i.test(line)) return '2 za cenę 1';
  if (/3\s*za\s*cen[ęe]\s*2/i.test(line)) return '3 za cenę 2';
  if (/opust\s+promocyjn/i.test(line)) return 'Promo';
  const pctMatch = line.match(/-(\d+(?:[.,]\d+)?)\s*%/);
  if (pctMatch) return `-${pctMatch[1]}%`;
  if (/gratis|bezpłatn|free/i.test(line)) return 'gratis';
  return undefined;
}

// ─── VAT code stripping ───────────────────────────────────────────────────────

function stripVatCode(line: string): string {
  let s = line.replace(/(\d+[.,]\d{1,3})\s*[A-E]\s*$/, '$1');
  s = s.replace(/\s{2,}[A-E]\s{2,}(\d+[.,]\d{1,3}\s*$)/, '  $1');
  return s;
}

// ─── Regex patterns ───────────────────────────────────────────────────────────

const FULL_RE = /^(.+?)\s{2,}(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{1,3})\s*$/i;
const SIMPLE_RE = /^(.+?)\s{1,}(\d+[.,]\d{2})\s*$/;
const WEIGHT_RE = /^(\d+[.,]\d+)\s*(?:kg|g|dag|l|ml|szt)\.?\s*[x×*]\s*(\d+[.,]\d{2,3})(?:[/\\](?:kg|g|dag|l|szt))?/i;
const PRODUCT_INFO_RE = /^(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{1,3})\s*$/;
const WEIGHT_INLINE_RE = /^(\d+[.,]\d+)\s*kg\s*[x×*]\s*(\d+[.,]\d{2})\/kg\s+(\d+[.,]\d{2})/i;
const DISCOUNT_KW_RE = /^(?:RABAT(?:\s+\w+)?|OPUST|ZNIZKA|ZNIZK|PROMOCJA|OBNIŻKA|OBN|UPUST|KDR|LIDL\s*PLUS|PLUS\s*KUPON|KUPON|BON|VOUCHER|APLIKACJA|APP|MOJA\s*BIEDRONKA|BIEDRONKA\s*APP|GRATIS(?:\s+ZA)?\s+[-–]?(\d+[.,]\d{2})|HAPPY\s*HOUR|OFERTA|KARTA\s*STAŁ|KARTA\s*RABAT|ZWROT)\s*[-–]?\s*(\d+[.,]\d{2})/i;
const DISCOUNT_NEG_RE = /^[#*]?\s*[-–]\s*(\d+[.,]\d{2})\s*$/;
const INLINE_DISC_RE = /^.+\s{2,}[-–]\s*(\d+[.,]\d{2})\s*$/;
const PRICE_ONLY_RE = /^\s*(\d+[.,]\d{1,3})\s*$/;

const DEPOSIT_RETURN_RE = /opakowan(?:ia|ie)?\s*zwrotn|zwrot\s*kaucj|\bopak\.?\s*bez\s*kau/i;
const DEPOSIT_SECTION_TOTAL_RE = /przyj[ęe]|wydan|\bsuma\b|\brazem\b/i;
const TRAIL_NEG_RE = /[-–]\s*(\d+[.,]\d{1,2})\s*$/;

const DEPOSIT_CHARGE_RE = /\bkaucj/i;
const TRAIL_POS_RE = /(\d+[.,]\d{1,2})\s*$/;

const SKIP_RE = /^(SUMA|RAZEM|DO ZAP[ŁL]ATY|[ŁL][AĄ]CZNIE|PTU|KWOTA|VAT\s+[A-E]|PARAGON|DZIE[NK]UJEMY|DZIE[NK]\.?|THANK|KOD\s|NIP|DATA\s|KASJER|ZAPRASZAMY|ZMIANA|GOT[ÓO]WKA|KARTA|P[ŁL]ATNO|FISKALNY|WYDRUK|POKWITOWANIE|ORYGINA[ŁL]|KOPIA|NUMER|TERMINAL|TRANSAKCJA|APPROVED|AUTORYZ|POWROT|POWRÓT|CASHBACK|SPRZEDAŻ|SPRZEDAZ|SALDO|ODBIÓR|ODBIORY|SERIA|KASY|KAS\s|CZĄSTK|CZASTK|SUMA\s+CZĄSTK|NADRUK|PARAGON FISKALN|KOPIĘ|NIEFISKALN)/i;

// ─── Abbreviation expansion ───────────────────────────────────────────────────

const ABBR_MAP: [RegExp, string][] = [
  [/\bpier\.?\s*z\.?\s*kurcz\.?\b/i,   'Pierś z kurczaka'],
  [/\bpol\.?\s*z\.?\s*kurcz\.?\b/i,    'Polędwica z kurczaka'],
  [/\bfil\.?\s*z\.?\s*kurcz\.?\b/i,    'Filet z kurczaka'],
  [/\bpier\.?\s*ind\.?\b/i,            'Pierś z indyka'],
  [/\bpol\.?\s*wieprzow\.?\b/i,        'Polędwica wieprzowa'],
  [/\bschab\s+b\.?\s*k\.?\b/i,         'Schab bez kości'],
  [/\bschab\s+bez\.?\b/i,              'Schab bez kości'],
  [/\bkarkówk\.?\b/i,                  'Karkówka'],
  [/\bmiel\.?\s+wieprzow\.?\b/i,       'Mielona wieprzowa'],
  [/\bmiel\.?\s+mieszana\.?\b/i,       'Mielona mieszana'],
  [/\bwędl\.?\b/i,                     'Wędlina'],
  [/\bkiełb\.?\b/i,                    'Kiełbasa'],
  [/\bpasztet\.?\b/i,                  'Pasztet'],
  [/\bwołow\.?\b/i,                    'Wołowina'],
  [/\bwieprzow\.?\b/i,                 'Wieprzowina'],
  [/\bdrob\.?\b/i,                     'Drób'],
  [/\bkurcz\.?\b/i,                    'Kurczak'],
  [/\bindyk\.?\b/i,                    'Indyk'],
  [/\bjogurt\s+nat\.?\b/i,             'Jogurt naturalny'],
  [/\bjogurt\s+pit\.?\b/i,             'Jogurt pitny'],
  [/\bjogurt\s+greck\.?\b/i,           'Jogurt grecki'],
  [/\bśmiet\.?\b/i,                    'Śmietana'],
  [/\bśmietank\.?\b/i,                 'Śmietanka'],
  [/\bser\s+żółt\.?\b/i,              'Ser żółty'],
  [/\bser\s+twarog\.?\b/i,            'Ser twarogowy'],
  [/\btwaróg\s+chud\.?\b/i,           'Twaróg chudy'],
  [/\bmasło\s+ekstr\.?\b/i,           'Masło extra'],
  [/\bziem\.?\b/i,                     'Ziemniaki'],
  [/\bogórk\.?\b/i,                    'Ogórki'],
  [/\bpom\.?\s+gruntow\.?\b/i,        'Pomidory gruntowe'],
  [/\bpap\.?\s+czerw\.?\b/i,          'Papryka czerwona'],
  [/\bpap\.?\s+żółt\.?\b/i,           'Papryka żółta'],
  [/\bpap\.?\s+ziel\.?\b/i,           'Papryka zielona'],
  [/\bsałat\.?\b/i,                    'Sałata'],
  [/\bkapust\.?\b/i,                   'Kapusta'],
  [/\bbrokuł\.?\b/i,                   'Brokuł'],
  [/\bszpinak\.?\b/i,                  'Szpinak'],
  [/\bbanan\.?\b/i,                    'Banan'],
  [/\bjabłk\.?\b/i,                    'Jabłka'],
  [/\bpomarańcz\.?\b/i,               'Pomarańcze'],
  [/\bbułk\.?\s+kajz\.?\b/i,          'Bułka kajzerka'],
  [/\bchleb\s+razow\.?\b/i,           'Chleb razowy'],
  [/\bchleb\s+żytn\.?\b/i,            'Chleb żytni'],
  [/\bchleb\s+orkisz\.?\b/i,          'Chleb orkiszowy'],
  [/\bpap\.?\s+toal\.?\b/i,           'Papier toaletowy'],
  [/\bpap\.?\s+kuch\.?\b/i,           'Papier kuchenny'],
  [/\bchust\.?\s+nawil\.?\b/i,        'Chusteczki nawilżane'],
  [/\bchust\.?\s+hyg\.?\b/i,          'Chusteczki higieniczne'],
  [/\bchust\.?\s+kosm\.?\b/i,         'Chusteczki kosmetyczne'],
  [/\bszamp\.?\b/i,                    'Szampon'],
  [/\bpast\.?\s+z\.?\s*zęb\.?\b/i,   'Pasta do zębów'],
  [/\bdezod\.?\b/i,                    'Dezodorant'],
  [/\bżel\s+p\.?\s*prysz\.?\b/i,     'Żel pod prysznic'],
  [/\bpłyn\s+do\s+nacz\.?\b/i,       'Płyn do naczyń'],
  [/\bpłyn\s+do\s+płuk\.?\b/i,       'Płyn do płukania'],
  [/\bproszek\s+do\s+pran\.?\b/i,    'Proszek do prania'],
  [/\bkaps\.?\s+do\s+pran\.?\b/i,    'Kapsułki do prania'],
  [/\bdet\.?\s+kaps\.?\b/i,           'Detergent kapsułki'],
  [/\bwoda\s+min\.?\s+nieg\.?\b/i,   'Woda mineralna niegazowana'],
  [/\bwoda\s+min\.?\s+gaz\.?\b/i,    'Woda mineralna gazowana'],
  [/\bwoda\s+min\.?\b/i,              'Woda mineralna'],
  [/\bwoda\s+sm\.?\b/i,               'Woda smakowa'],
  [/\bnap\.?\s+gaz\.?\b/i,            'Napój gazowany'],
  [/\bnap\.?\s+energet\.?\b/i,        'Napój energetyczny'],
  [/\bpierogi\s+ru\.?\b/i,            'Pierogi ruskie'],
  [/\bpierogi\s+z\s+m\.?\b/i,        'Pierogi z mięsem'],
  [/\bnaleśn\.?\b/i,                  'Naleśniki'],
  [/\bzupa\s+krem\.?\b/i,             'Zupa krem'],
  [/\.{1,2}\s*$/, ''],   // strip trailing dots
];

function expandAbbreviations(name: string): string {
  let s = name;
  for (const [pattern, replacement] of ABBR_MAP) {
    s = s.replace(pattern, replacement);
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function cleanName(raw: string): string {
  let s = raw.replace(/^[*#@]\s*/, '').trim();
  s = s.replace(/\s+[A-E]\s*$/, '').trim();
  s = s.replace(/^\d{6,13}\s+/, '');
  s = s.replace(/\s+(?:PLN|Z[ŁL])$/i, '').trim();
  s = expandAbbreviations(s);
  return s;
}

// ─── Shared detectors (used by every store parser) ────────────────────────────

function parsePrice(s: string): number {
  const m = s.match(/(\d+)\s*[.,]\s*(\d{2})\b/);
  if (m) return parseFloat(`${m[1]}.${m[2]}`);
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

export type StoreKey = 'kaufland' | 'biedronka' | 'lidl' | 'generic';

function storeKeyFromText(text: string): StoreKey {
  const head = text.slice(0, 400);
  if (/\bkaufland\b/i.test(head) || /\bkaufland\b/i.test(text)) return 'kaufland';
  if (/\bbiedronka\b|jeronimo\s*martins/i.test(head) || /\bbiedronka\b|jeronimo\s*martins/i.test(text)) return 'biedronka';
  if (/\blidl\b/i.test(head) || /\blidl\b/i.test(text)) return 'lidl';
  return 'generic';
}

function detectStoreName(text: string, lines: string[]): string | undefined {
  const headerText = lines.slice(0, 12).join(' ');
  for (const brand of STORE_BRANDS) if (brand.pattern.test(headerText)) return brand.name;
  for (const brand of STORE_BRANDS) if (brand.pattern.test(text)) return brand.name;
  return undefined;
}

function detectDate(text: string): string | undefined {
  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];
  const dmyMatch = text.match(/\b(\d{2}[./]\d{2}[./]\d{4})\b/);
  if (dmyMatch) {
    const p = dmyMatch[1].split(/[./]/);
    return `${p[2]}-${p[1]}-${p[0]}`;
  }
  return undefined;
}

function detectPaymentTotal(text: string): number {
  const m = text.match(/P[łl]atno[śs][ćc][^\n\d]*?(\d+\s*[.,]\s*\d{2})/i);
  return m ? parsePrice(m[1]) : 0;
}

function detectTotal(text: string): number {
  const paymentTotal = detectPaymentTotal(text);
  if (paymentTotal > 0) return paymentTotal;
  const totalPatterns = [
    /SUMA\s+PLN\s+(\d+\s*[.,]\s*\d{2})/i,
    /DO\s+ZAP[ŁL]ATY\s+(?:PLN\s+)?(\d+\s*[.,]\s*\d{2})/i,
    /RAZEM\s+(?:PLN\s+)?(\d+\s*[.,]\s*\d{2})/i,
    /SUMA\s*:?\s*(\d+\s*[.,]\s*\d{2})/i,
    /[ŁL][AĄ]CZNIE\s+(?:PLN\s+)?(\d+\s*[.,]\s*\d{2})/i,
    /TOTAL\s+PLN\s+(\d+\s*[.,]\s*\d{2})/i,
    /TOTAL\s+(?:PLN\s+)?(\d+\s*[.,]\s*\d{2})/i,
  ];
  for (const pat of totalPatterns) {
    const m = text.match(pat);
    if (m) return parsePrice(m[1]);
  }
  return 0;
}

function isDepositName(s: string): boolean {
  return /butelka\s*pet|kaucja|opłat[ay]?\s*depoz|depozyt|\bpet\b/i.test(s);
}

// ─── Store router ─────────────────────────────────────────────────────────────

const SUSPECT_NAME_RE = /^(total|suma|razem|price\s*in\s*pln|ptu|taxed|none|do\s*zap|reszta|sprzeda|p[łl]atno|got[óo]wk|karta|kwota|vat|paragon|niefiskal|fiskaln)/i;

function stripPrintMarkup(text: string): string {
  return text.replace(/&\d/g, '');
}

export function parseReceiptText(rawText: string): ParsedReceipt {
  const text = stripPrintMarkup(rawText);
  let r: ParsedReceipt;
  switch (storeKeyFromText(text)) {
    case 'kaufland':  r = parseKaufland(text); break;
    case 'biedronka': r = parseBiedronka(text); break;
    default:          r = parseGeneric(text); break;
  }
  for (const it of r.items) {
    if (it.kind === 'deposit') continue;
    if (SUSPECT_NAME_RE.test(it.name) || /^[\d\s.,]+$/.test(it.name)) it.suspect = true;
  }
  return r;
}

// ─── Kaufland — app "Receipt copy" (digital, byte-exact) ───────────────────────

const KFL_COPY_HEADER_RE = /^Cena\s+PLN$/i;
const KFL_COPY_SUBTOTAL_RE = /^Suma(?:\s*cz[ąa]stkowa)?\s+(\d+[.,]\d{2})$/i;
const KFL_COPY_VAT_TABLE_RE = /^Vat\s*%/i;
const KFL_COPY_ITEM_QTY_RE = /^(.+?)\s+(\d+)\s*\*\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{2})\s*[A-E]$/;
const KFL_COPY_CONT_QTY_RE = /^(\d+)\s*\*\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{2})\s*[A-E]$/;
const KFL_COPY_CONT_WEIGHT_RE = /^(\d+[.,]\d+)\s*KG\s+(\d+[.,]\d{2})\s*[A-E]$/i;
const KFL_COPY_ITEM_PRICE_RE = /^(.+?)\s+(\d+[.,]\d{2})\s*[A-E]$/;
const KFL_COPY_DISCOUNT_RE = /-(\d+[.,]\d{2})\s*$/;

function isKauflandReceiptCopy(text: string): boolean {
  return text.split('\n').some(l => KFL_COPY_HEADER_RE.test(l.trim()));
}

function parseKauflandReceiptCopy(text: string): ParsedReceipt {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const items: ReceiptItem[] = [];

  const emit = (name: string, quantity: number, unitPrice: number, price: number) => {
    if (price <= 0 || price > 5000) return;
    if (isDepositName(name)) {
      items.push({ name: 'Kaucja (butelka)', quantity: 1, unitPrice: price, price, kind: 'deposit' });
      return;
    }
    const clean = cleanName(name);
    if (clean.length < 2) return;
    items.push({ name: clean, quantity, unitPrice, price, foodSubcat: categorizeFoodSubcat(clean) });
  };

  const startIdx = lines.findIndex(l => KFL_COPY_HEADER_RE.test(l));
  const endIdx = lines.findIndex(l => KFL_COPY_SUBTOTAL_RE.test(l));
  const itemLines = startIdx >= 0 && endIdx > startIdx ? lines.slice(startIdx + 1, endIdx) : [];

  let pendingName: string | null = null;
  for (let i = 0; i < itemLines.length; i++) {
    const raw = itemLines[i];

    if (pendingName) {
      const cq = raw.match(KFL_COPY_CONT_QTY_RE);
      if (cq) { emit(pendingName, parseInt(cq[1], 10), parsePrice(cq[2]), parsePrice(cq[3])); pendingName = null; continue; }
      const cw = raw.match(KFL_COPY_CONT_WEIGHT_RE);
      if (cw) {
        const weight = parseFloat(cw[1].replace(',', '.'));
        const price = parsePrice(cw[2]);
        const unitPrice = weight > 0 ? Math.round((price / weight) * 100) / 100 : 0;
        emit(pendingName, weight, unitPrice, price);
        pendingName = null; continue;
      }
      pendingName = null;
    }

    const iq = raw.match(KFL_COPY_ITEM_QTY_RE);
    if (iq) { emit(iq[1], parseInt(iq[2], 10), parsePrice(iq[3]), parsePrice(iq[4])); continue; }

    const ip = raw.match(KFL_COPY_ITEM_PRICE_RE);
    if (ip) { emit(ip[1], 1, parsePrice(ip[2]), parsePrice(ip[2])); continue; }

    const next = itemLines[i + 1];
    if (next && (KFL_COPY_CONT_QTY_RE.test(next) || KFL_COPY_CONT_WEIGHT_RE.test(next))) {
      pendingName = raw;
    }
  }

  // Checkout-level promos ("Kup 2 płać za 1 -11,97" + "Pozycje:3,4") allocated
  // proportionally onto the referenced items' price (1-indexed), tak żeby subtotal
  // (suma price) od razu zgadzała się z total, bez osobnego pola na "rabat ogólny".
  const vatIdx = lines.findIndex((l, idx) => idx > endIdx && KFL_COPY_VAT_TABLE_RE.test(l));
  const promoBand = endIdx >= 0 ? lines.slice(endIdx + 1, vatIdx >= 0 ? vatIdx : undefined) : [];
  const posRe = /^Pozycje:\s*([\d,\s]+)$/i;
  let totalDiscount = 0;
  for (let i = 0; i < promoBand.length; i++) {
    const dm = promoBand[i].match(KFL_COPY_DISCOUNT_RE);
    if (!dm) continue;
    const amount = parsePrice(dm[1]);
    totalDiscount += amount;

    const pm = promoBand[i + 1]?.match(posRe);
    if (!pm) continue;
    const indices = [...new Set(pm[1].split(',').map(n => parseInt(n.trim(), 10)))]
      .filter(n => n >= 1 && n <= items.length);
    if (!indices.length) continue;
    const promoName = promoBand[i].replace(KFL_COPY_DISCOUNT_RE, '').trim();
    const weightSum = indices.reduce((s, idx) => s + items[idx - 1].price, 0);
    if (weightSum <= 0) continue;
    let allocated = 0;
    indices.forEach((idx, j) => {
      const it = items[idx - 1];
      const isLast = j === indices.length - 1;
      const share = isLast ? Math.round((amount - allocated) * 100) / 100 : Math.round((it.price / weightSum) * amount * 100) / 100;
      allocated += share;
      it.discount = Math.round(((it.discount ?? 0) + share) * 100) / 100;
      it.price = Math.max(0, Math.round((it.price - share) * 100) / 100);
      it.promotion = it.promotion ?? promoName;
    });
  }

  const subtotal = items.reduce((s, p) => s + p.price, 0);
  const total = detectTotal(text);

  return {
    storeName: detectStoreName(text, lines) ?? 'Kaufland',
    date: detectDate(text),
    paymentMethod: detectPaymentMethod(text),
    items, subtotal, totalDiscount, total: total || subtotal, raw: text,
  };
}

// ─── Kaufland — OCR photo scan ─────────────────────────────────────────────────

const KFL_PRICE_RE = /^\d+\s*[.,]\s*\d{2}$/;

function parseKaufland(text: string): ParsedReceipt {
  if (isKauflandReceiptCopy(text)) return parseKauflandReceiptCopy(text);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const items: ReceiptItem[] = [];
  const totalDiscount = 0;
  let pendingName: string | null = null;
  let pendingDeposit = false;
  const strayPrices: number[] = [];

  const emit = (name: string, price: number, deposit: boolean) => {
    if (price <= 0 || price > 5000) return;
    if (deposit) {
      items.push({ name: 'Kaucja (butelka)', quantity: 1, unitPrice: price, price, kind: 'deposit' });
    } else {
      const clean = cleanName(name);
      if (clean.length < 2) return;
      items.push({ name: clean, quantity: 1, unitPrice: price, price, foodSubcat: categorizeFoodSubcat(clean) });
    }
  };

  const flushPending = () => {
    if (pendingName !== null && strayPrices.length) {
      emit(pendingName, strayPrices.shift()!, pendingDeposit);
    }
    pendingName = null; pendingDeposit = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (i === 0) continue;
    if (/^price in pln$/i.test(raw)) continue;
    if (/^(total|suma|razem|do zap|p[łl]atno|got[óo]wka|karta)\b/i.test(raw)) { flushPending(); break; }
    if (/^none$/i.test(raw)) continue;

    if (KFL_PRICE_RE.test(raw)) {
      const price = parsePrice(raw);
      if (pendingName !== null) { emit(pendingName, price, pendingDeposit); pendingName = null; pendingDeposit = false; }
      else strayPrices.push(price);
      continue;
    }

    const inlineM = raw.match(/^(.+?)\s+(\d+[.,]\d{2})$/);
    if (inlineM && /[A-Za-zżźćńółęąśŻŹĆĄŚĘÓŁŃ]/.test(inlineM[1]) && !SKIP_RE.test(raw)) {
      flushPending();
      emit(inlineM[1], parsePrice(inlineM[2]), isDepositName(inlineM[1]));
      continue;
    }

    if (raw.length < 2 || !/[A-Za-zżźćńółęąśŻŹĆĄŚĘÓŁŃ]/.test(raw)) continue;
    flushPending();
    pendingName = raw;
    pendingDeposit = isDepositName(raw);
  }
  flushPending();

  const subtotal = items.reduce((s, p) => s + p.price, 0);
  const total = detectTotal(text);
  return {
    storeName: detectStoreName(text, lines) ?? 'Kaufland',
    date: detectDate(text),
    paymentMethod: detectPaymentMethod(text),
    items, subtotal, totalDiscount, total: total || subtotal, raw: text,
  };
}

// ─── Biedronka ────────────────────────────────────────────────────────────────

const BIE_ITEM_RE = /([A-Za-zżźćńółęąśŻŹĆĄŚĘÓŁŃ][^\n]*?)\s+([ABC])\s*(\d+[.,]\d{1,3})\s*[x×*]\s*(\d+[.,]\d{1,2})/g;

function parseBiedronka(text: string): ParsedReceipt {
  const items: ReceiptItem[] = [];
  const flat = text.replace(/\r/g, '');
  let m: RegExpExecArray | null;
  BIE_ITEM_RE.lastIndex = 0;
  while ((m = BIE_ITEM_RE.exec(flat)) !== null) {
    let rawName = m[1].trim();
    rawName = rawName.replace(/^.*?\d+[.,]\d{2}[A-C]?\s+/, '');
    rawName = rawName.replace(/^.*[x×*]\s*\d+[.,]\d{1,2}\s+/i, '');
    rawName = rawName.replace(/^(discount|rabat|opust)\s+/i, '');
    rawName = rawName.trim();
    const qty = parseFloat(m[3].replace(',', '.'));
    const unit = parseFloat(m[4].replace(',', '.'));
    if (unit <= 0 || unit > 5000) continue;
    const name = cleanName(rawName);
    if (name.length < 2) continue;
    const price = Math.round(qty * unit * 100) / 100;
    if (price <= 0 || price > 5000) continue;
    items.push({ name, quantity: qty, unitPrice: unit, price, foodSubcat: categorizeFoodSubcat(name) });
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const subtotal = items.reduce((s, p) => s + p.price, 0);
  const total = detectTotal(text);
  return {
    storeName: detectStoreName(text, lines) ?? 'Biedronka',
    date: detectDate(text),
    paymentMethod: detectPaymentMethod(text),
    items, subtotal, totalDiscount: 0, total: total || subtotal, raw: text,
  };
}

// ─── Generic parser (fallback for all other stores) ───────────────────────────

function parseGeneric(text: string): ParsedReceipt {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const items: ReceiptItem[] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let storeName: string | undefined;
  let date: string | undefined;
  let lastItem: ReceiptItem | null = null;
  let pendingName: string | null = null;

  const headerText = lines.slice(0, 12).join(' ');
  for (const brand of STORE_BRANDS) {
    if (brand.pattern.test(headerText)) { storeName = brand.name; break; }
  }
  if (!storeName) {
    for (const brand of STORE_BRANDS) {
      if (brand.pattern.test(text)) { storeName = brand.name; break; }
    }
  }

  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const dmyMatch = text.match(/\b(\d{2}[./]\d{2}[./]\d{4})\b/);
  if (isoMatch) {
    date = isoMatch[1];
  } else if (dmyMatch) {
    const parts = dmyMatch[1].split(/[./]/);
    date = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  const total = detectTotal(text);

  const addItem = (it: ReceiptItem) => {
    if (it.name.length < 2) return;
    if (it.price > 5000) return;
    items.push(it);
    lastItem = it;
    subtotal += it.price;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];

    const wil = raw.match(WEIGHT_INLINE_RE);
    if (wil && lastItem !== null && pendingName === null) {
      const li  = lastItem as ReceiptItem;
      const qty = parseFloat(wil[1].replace(',', '.'));
      const u   = parseFloat(wil[2].replace(',', '.'));
      const tot = parseFloat(wil[3].replace(',', '.'));
      if (tot > 0 && tot < 5000) {
        subtotal -= li.price;
        li.quantity = qty; li.unitPrice = u; li.price = tot;
        subtotal += tot;
        continue;
      }
    }

    const wm = raw.match(WEIGHT_RE);
    if (wm && lastItem !== null && pendingName === null) {
      const li  = lastItem as ReceiptItem;
      const qty = parseFloat(wm[1].replace(',', '.'));
      const u   = parseFloat(wm[2].replace(',', '.'));
      const tot = Math.round(qty * u * 100) / 100;
      subtotal -= li.price;
      li.quantity = qty;
      li.unitPrice = u;
      li.price = tot;
      subtotal += tot;
      continue;
    }

    const line = stripVatCode(raw);

    if (SKIP_RE.test(line)) continue;
    if (/^\d{8,}$/.test(line)) continue;
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(line)) continue;
    if (/^\d+\s+\d+\s+nr:/i.test(line)) continue;

    if (DEPOSIT_RETURN_RE.test(line)) {
      if (DEPOSIT_SECTION_TOTAL_RE.test(line)) { pendingName = null; continue; }
      const neg = line.match(TRAIL_NEG_RE);
      if (neg) {
        const amt = -parseFloat(neg[1].replace(',', '.'));
        const depName = /zwrot|kaucj/i.test(line) ? 'Zwrot kaucji' : 'Opakowanie zwrotne';
        items.push({ name: depName, quantity: 1, unitPrice: amt, price: amt, kind: 'deposit' });
        lastItem = null;
        subtotal += amt;
      }
      pendingName = null;
      continue;
    }

    if (DEPOSIT_CHARGE_RE.test(line)) {
      const pos = line.match(TRAIL_POS_RE);
      if (pos) {
        const amt = parseFloat(pos[1].replace(',', '.'));
        if (amt > 0 && amt < 5000) {
          items.push({ name: 'Kaucja (butelka)', quantity: 1, unitPrice: amt, price: amt, kind: 'deposit' });
          lastItem = null;
          subtotal += amt;
        }
      }
      pendingName = null;
      continue;
    }

    const promo = detectPromotion(line);

    const dkm = line.match(DISCOUNT_KW_RE);
    const dnm = line.match(DISCOUNT_NEG_RE);
    const dim = line.match(INLINE_DISC_RE);
    if ((dkm || dnm || dim) && lastItem !== null) {
      const li   = lastItem as ReceiptItem;
      const dkmVal = dkm ? (dkm[2] ?? dkm[1]) : undefined;
      const disc = parseFloat((dkmVal ?? (dnm ? dnm[1] : dim![1])).replace(',', '.'));
      if (disc > 0) {
        li.discount   = (li.discount ?? 0) + disc;
        li.price      = Math.max(0, li.price - disc);
        li.promotion  = li.promotion ?? detectPromotion(raw) ?? `−${disc.toFixed(2)} zł`;
        subtotal      -= disc;
        totalDiscount += disc;
      }
      pendingName = null;
      continue;
    }

    if (pendingName) {
      const wm2 = raw.match(WEIGHT_RE);
      if (wm2) {
        const qty  = parseFloat(wm2[1].replace(',', '.'));
        const u    = parseFloat(wm2[2].replace(',', '.'));
        const totalM = line.match(/(\d+[.,]\d{1,3})\s*$/);
        const tot  = totalM
          ? parseFloat(totalM[1].replace(',', '.'))
          : Math.round(qty * u * 100) / 100;
        if (tot > 0 && tot < 5000) {
          addItem({ name: pendingName, quantity: qty, unitPrice: u, price: tot, foodSubcat: categorizeFoodSubcat(pendingName), promotion: promo });
          pendingName = null; continue;
        }
      }
      const wil2 = raw.match(WEIGHT_INLINE_RE);
      if (wil2) {
        const qty = parseFloat(wil2[1].replace(',', '.'));
        const u   = parseFloat(wil2[2].replace(',', '.'));
        const tot = parseFloat(wil2[3].replace(',', '.'));
        if (tot > 0 && tot < 5000) {
          addItem({ name: pendingName, quantity: qty, unitPrice: u, price: tot, foodSubcat: categorizeFoodSubcat(pendingName), promotion: promo });
          pendingName = null; continue;
        }
      }
      const pm = line.match(PRICE_ONLY_RE);
      if (pm) {
        const price = parseFloat(pm[1].replace(',', '.'));
        if (price > 0 && price < 5000) {
          addItem({ name: pendingName, quantity: 1, unitPrice: price, price, foodSubcat: categorizeFoodSubcat(pendingName), promotion: promo });
          pendingName = null; continue;
        }
      }
      const pim = line.match(PRODUCT_INFO_RE);
      if (pim) {
        const qty = parseFloat(pim[1].replace(',', '.'));
        const u   = parseFloat(pim[2].replace(',', '.'));
        const tot = parseFloat(pim[3].replace(',', '.'));
        if (tot > 0 && tot < 5000) {
          addItem({ name: pendingName, quantity: qty, unitPrice: u, price: tot, foodSubcat: categorizeFoodSubcat(pendingName), promotion: promo });
          pendingName = null; continue;
        }
      }
      pendingName = null;
    }

    const fm = line.match(FULL_RE);
    if (fm) {
      const name = cleanName(fm[1]);
      const qty  = parseFloat(fm[2].replace(',', '.'));
      const u    = parseFloat(fm[3].replace(',', '.'));
      const tot  = parseFloat(fm[4].replace(',', '.'));
      if (tot < 5000 && name.length >= 2) {
        addItem({ name, quantity: qty, unitPrice: u, price: tot, foodSubcat: categorizeFoodSubcat(name), promotion: promo });
      }
      continue;
    }

    const sm = line.match(SIMPLE_RE);
    if (sm) {
      const name  = cleanName(sm[1]);
      const price = parseFloat(sm[2].replace(',', '.'));
      if (price > 0 && price < 5000 && name.length >= 2 &&
          !/^(PLN|ZŁ|ZL|\d+|[A-E]|PTU|VAT|SUMA|RAZEM|KARTA|KASJER|ZMIANA)$/i.test(name) &&
          !/^\d+$/.test(name)) {
        addItem({ name, quantity: 1, unitPrice: price, price, foodSubcat: categorizeFoodSubcat(name), promotion: promo });
      }
      continue;
    }

    if (promo && lastItem !== null && !(lastItem as ReceiptItem).promotion) {
      (lastItem as ReceiptItem).promotion = promo;
      continue;
    }

    if (line.length >= 2 && !/^\d/.test(line) && !/^[A-E]\s/.test(line)) {
      const nextRaw = lines[idx + 1];
      if (nextRaw) {
        const nextClean = stripVatCode(nextRaw.trim());
        if (
          PRICE_ONLY_RE.test(nextClean) ||
          nextClean.match(WEIGHT_RE) ||
          nextClean.match(WEIGHT_INLINE_RE) ||
          PRODUCT_INFO_RE.test(nextClean)
        ) {
          pendingName = cleanName(line);
        }
      }
    }
  }

  return {
    storeName,
    date,
    items,
    subtotal: subtotal || total,
    totalDiscount,
    total: total || subtotal,
    paymentMethod: detectPaymentMethod(text),
    raw: text,
  };
}
