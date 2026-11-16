// Ciekawostki (2026-11-16: przeniesione z Dashboardu do Daily — na Dashboardzie w ich
// miejscu baterie urządzeń). Dzień roku wybiera startową, stuknięcie pokazuje następną.
export const FACTS = [
  'Mózg zużywa jedną piątą energii twojego organizmu',
  'Grafen jest ok. 200× wytrzymalszy od stali przy tej samej masie',
  'Atom złota ma średnicę ok. 0,3 nm',
  'GaAs przewodzi elektrony ok. 6× szybciej niż krzem',
  'Tytan jest tak wytrzymały jak stal, a o ok. 45% lżejszy',
  'Diament i grafit to ten sam pierwiastek — węgiel, inaczej ułożony',
  'Aluminium było kiedyś droższe od złota — dopóki nie wynaleziono elektrolizy',
  'Szkło metaliczne nie ma kryształów — atomy są ułożone chaotycznie jak w cieczy',
  'Wolfram ma najwyższą temperaturę topnienia z metali: ok. 3422 °C',
  'Hel nie zamarza pod normalnym ciśnieniem nawet w pobliżu zera absolutnego',
  'Pajęczy jedwab jest — przy tej samej masie — mocniejszy od stali',
  'Nadprzewodnik wypycha pole magnetyczne — dlatego magnes może nad nim lewitować',
  'Stop z pamięcią kształtu (nitinol) po podgrzaniu wraca do zapamiętanej formy',
  'Ciało ludzkie ma ok. 37 bilionów komórek',
  'Sen głęboki to czas, gdy mózg najmocniej „sprząta” produkty przemiany materii',
  'Światło ze Słońca leci do Ziemi ok. 8 minut i 20 sekund',
  'Na Wenus doba jest dłuższa niż rok',
  'Ośmiornica ma trzy serca i niebieską krew',
  'Miód prawidłowo przechowywany praktycznie się nie psuje',
  'Banany są lekko radioaktywne — przez potas-40',
  'Wieża Eiffla latem jest kilkanaście centymetrów wyższa przez rozszerzalność cieplną stali',
  'Woda jest najgęstsza w ok. 4 °C — dlatego lód pływa, a jeziora zamarzają od góry',
  'Krzem to po tlenie drugi najczęstszy pierwiastek w skorupie ziemskiej',
  'Pierwszy tranzystor (1947) był większy od dłoni; dziś mają kilka nanometrów',
  'Beton rzymski z popiołem wulkanicznym z czasem staje się mocniejszy w wodzie morskiej',
  'Kevlar jest ok. 5× wytrzymalszy od stali przy tej samej masie',
  'Szkło hartowane jest ok. 4× wytrzymalsze od zwykłego i pęka na drobne kostki',
  'Lit to najlżejszy metal — pływa po wodzie (i z nią reaguje)',
  'Rtęć to jedyny metal ciekły w temperaturze pokojowej',
  'Krótka drzemka 10–20 min poprawia czujność bez uczucia „zamulenia”',
];

export function dayOfYear(d: Date): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
}

export const factOfDay = (d: Date) => dayOfYear(d) % FACTS.length;
