import ART from '@/data/factArt.json';
import type { Fact, FactCat } from './factsData';

// Ikona pixel-art konkretnej ciekawostki (2026-11-25, user: "tematyczne — mózg, sen z księżycem
// czy łóżkiem — i żeby były wygenerowane"). Rysunki generuje scripts/gen-fact-art.py
// (kształty + automatyczne cieniowanie, 16×16) do src/data/factArt.json. Tutaj tylko: która
// ciekawostka → który motyw. Kolejność: przypisanie po id → słowa kluczowe z tematu/zajawki
// (nowe ciekawostki bez wpisu) → motyw dziedziny.
export type ArtSprite = { rows: string[]; pal: Record<string, string> };
export const FACT_ART = ART as unknown as Record<string, ArtSprite>;
export const ART_SIZE = 16;

export const ART_BY_FACT: Record<string, string> = {
  // zdrowie
  'z-sen-pamiec': 'sleep', 'z-siedzenie': 'chair', 'z-swiatlo-rano': 'sun', 'z-kofeina': 'coffee',
  'z-sila-chwytu': 'dumbbell', 'z-oddech': 'lungs', 'z-cukier': 'bottle',
  'z2-ekran-sen': 'sleep', 'z2-spacer-po-jedzeniu': 'sneaker', 'z2-ruch-depresja': 'smile',
  'z2-relacje': 'people', 'z2-orzechy': 'acorn', 'z2-witamina-d': 'sun', 'z2-jetlag-spoleczny': 'alarmclock',
  // medycyna
  'm-ospa': 'virus', 'm-mrna': 'syringe', 'm-crispr': 'dna', 'm-placebo': 'pill', 'm-opornosc': 'bacteria',
  'm-rtg': 'bone', 'm-serce': 'heart', 'm-insulina': 'syringe',
  'm2-narkoza': 'flask', 'm2-semmelweis': 'soap', 'm2-genom': 'dna', 'm2-polio': 'syringe',
  'm2-sluch': 'ear', 'm2-mikrobiom': 'bacteria', 'm2-przeszczep-serca': 'heart',
  // materiały
  'mat-beton-rzymski': 'bricks', 'mat-aerozel': 'cloud', 'mat-szklo-tel': 'phone', 'mat-pajeczyna': 'web',
  'mat-nitinol': 'spring', 'mat-krzem': 'chip', 'mat-tytan': 'bone', 'mat-diament': 'diamond',
  'mat2-szklo-nie-plynie': 'window', 'mat2-teflon': 'pan', 'mat2-rzepy': 'burr', 'mat2-nierdzewna': 'spoon',
  'mat2-perowskity': 'solar', 'mat2-wulkanizacja': 'tire', 'mat2-najczarniejsze': 'blackhole',
  // kosmos
  'k-voyager': 'satellite', 'k-neutronowa': 'star', 'k-mars': 'planet_red', 'k-jwst': 'hexmirror',
  'k-gwiazdy-w-nas': 'star', 'k-slady-ksiezyc': 'moon',
  'k2-olympus': 'volcano', 'k2-czarna-dziura': 'blackhole', 'k2-smieci': 'satellite', 'k2-merkury': 'planet_gray',
  'k2-lod-ksiezyc': 'moon', 'k2-predkosc': 'rocket',
  // świat wokół
  's-tlen-ocean': 'wave', 's-drzewa': 'tree', 's-grzyby': 'mushroom', 's-sahara': 'desert', 's-mrowki': 'ant',
  's-petrichor': 'raincloud', 's-doba': 'clock',
  's2-pletwal': 'whale', 's2-osmiornica': 'octopus', 's2-niesporczaki': 'bug', 's2-dno-oceanu': 'fish',
  's2-bursztyn': 'amber', 's2-platek-sniegu': 'snowflake',
  // lifehacki
  'l-2min': 'hourglass', 'l-chlodzenie': 'icecube', 'l-bateria': 'battery', 'l-cebula': 'onion',
  'l-powtorki': 'brain', 'l-telefon-obok': 'phone',
  'l2-jesli-to': 'signpost', 'l2-spacer-kreatywnosc': 'bulb', 'l2-temperatura-sypialni': 'bed', 'l2-66-dni': 'calendar',
  'l2-drzemka-kawowa': 'coffee', 'l2-lodowka': 'fridge', 'l2-pranie-30': 'washer',
  // technologie
  't-tranzystory': 'chip', 't-nanometry': 'chip', 't-gps': 'pin', 't-sms': 'bubble', 't-li-ion': 'battery',
  't-wifi': 'wifi', 't-kable': 'globe', 't-qr': 'qr', 't-centra-danych': 'server',
  't2-pierwsza-strona': 'monitor', 't2-malpa': 'at', 't2-pierwszy-dysk': 'floppy', 't2-apollo-komputer': 'rocket',
  't2-enigma': 'key', 't2-kod-kreskowy': 'barcode',
};

// Dla nowych ciekawostek bez wpisu wyżej: pierwsze pasujące słowo (rdzeń) z tematu i zajawki.
const KEYWORDS: [RegExp, string][] = [
  [/\bsn(u|em|ie)?\b|\bsen\b|śpi|drzem/i, 'sleep'], [/sypial|łóżk/i, 'bed'], [/mózg|pamię|nauk/i, 'brain'],
  [/serc/i, 'heart'], [/kaw|kofein|herbat/i, 'coffee'], [/płuc|oddech/i, 'lungs'], [/kość|kości|szkielet/i, 'bone'],
  [/bakteri|mikrob/i, 'bacteria'], [/wirus|ospa|gryp/i, 'virus'], [/szczepion|zastrzyk|insulin/i, 'syringe'],
  [/gen(y|ów|om)|dna/i, 'dna'], [/lek|tablet|placebo/i, 'pill'], [/słońc|witamin.*d|światł/i, 'sun'],
  [/księżyc/i, 'moon'], [/gwiazd/i, 'star'], [/mars|planet/i, 'planet_red'], [/rakiet|lot w kosmos/i, 'rocket'],
  [/satelit|orbit/i, 'satellite'], [/czarn.*dziur/i, 'blackhole'], [/ocean|morz|wod/i, 'wave'],
  [/drzew|las/i, 'tree'], [/grzyb/i, 'mushroom'], [/deszcz|chmur/i, 'raincloud'], [/śnieg|lód|zim/i, 'snowflake'],
  [/telefon|smartfon|ekran/i, 'phone'], [/bater|akumul/i, 'battery'], [/chip|procesor|tranzystor/i, 'chip'],
  [/internet|wi-?fi|sieć/i, 'wifi'], [/komputer|stron/i, 'monitor'], [/nawyk|dni\b|kalendarz/i, 'calendar'],
  [/czas|godzin|minut|zegar/i, 'clock'], [/spacer|chodz|krok/i, 'sneaker'], [/ruch|ćwicz|trening|mięś/i, 'dumbbell'],
  [/cukier|napój|słodk/i, 'bottle'], [/pomysł|kreatyw/i, 'bulb'], [/ludzi|przyjaci|relac/i, 'people'],
];

const BY_CAT: Record<FactCat, string> = {
  zdrowie: 'heart', medycyna: 'pill', materialy: 'diamond', kosmos: 'star', swiat: 'tree', lifehacki: 'bulb', tech: 'chip',
};

export function artKeyFor(f: Pick<Fact, 'id' | 'cat' | 'topic' | 'teaser'>): string {
  const byId = ART_BY_FACT[f.id];
  if (byId && FACT_ART[byId]) return byId;
  const text = `${f.topic} ${f.teaser}`;
  for (const [re, k] of KEYWORDS) if (re.test(text) && FACT_ART[k]) return k;
  return BY_CAT[f.cat] ?? 'bulb';
}

export function artFor(f: Pick<Fact, 'id' | 'cat' | 'topic' | 'teaser'>): ArtSprite {
  return FACT_ART[artKeyFor(f)];
}
