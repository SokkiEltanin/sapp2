// Treść ciekawostek (2026-11-16, user: "temat max 3 słowa, treść zachęcająca jako skrót,
// wyjaśnienie oparte na badaniach, liczbach, realnych danych"; dziedziny usera: zdrowie,
// medycyna, materiały, kosmos, otaczający nas świat, lifehacki, elektronika i technologie).
// Każda pokazuje się RAZ (utils/facts.ts) — dopisując nowe, dawaj NOWE `id` (nigdy nie
// zmieniaj istniejących: id są w historii przeczytanych na obu urządzeniach).
export type FactCat = 'zdrowie' | 'medycyna' | 'materialy' | 'kosmos' | 'swiat' | 'lifehacki' | 'tech';

export interface Fact {
  id: string;
  cat: FactCat;
  topic: string;                     // max 3 słowa
  teaser: string;                    // jedno zdanie, które ma zaciekawić
  nums: { v: string; l: string }[];  // 2–3 liczby z wyjaśnienia (pokazywane jako duże kafelki)
  body: string[];                    // akapity rozwinięcia
  src: string;
}

export const FACT_CATS: { k: FactCat; l: string }[] = [
  { k: 'zdrowie', l: 'Zdrowie' },
  { k: 'medycyna', l: 'Medycyna' },
  { k: 'materialy', l: 'Materiały' },
  { k: 'kosmos', l: 'Kosmos' },
  { k: 'swiat', l: 'Świat wokół' },
  { k: 'lifehacki', l: 'Lifehacki' },
  { k: 'tech', l: 'Technologie' },
];

export const FACT_LIST: Fact[] = [
  // ───────── ZDROWIE ─────────
  {
    id: 'z-sen-pamiec', cat: 'zdrowie', topic: 'Sen zapisuje pamięć',
    teaser: 'Noc po nauce jest równie ważna jak sama nauka — a nieprzespana kosztuje prawie połowę zdolności zapamiętywania.',
    nums: [{ v: '−40%', l: 'zdolności zapamiętywania po nieprzespanej nocy' }, { v: '7–9 h', l: 'zalecany sen dorosłego' }],
    body: [
      'W głębokim śnie (faza N3) hipokamp „odtwarza” wzorce z dnia i przekazuje je do kory mózgowej, gdzie zostają na dłużej. Widać to w EEG jako wolne fale zsynchronizowane z tzw. wrzecionami snu.',
      'W badaniu Yoo i Walkera (2007) osoby po nocy bez snu zapamiętywały nowe obrazy o ok. 40% gorzej niż wyspani, a skan mózgu pokazał słabszą aktywność hipokampa przy nauce.',
      'Wniosek praktyczny: zarwana noc przed egzaminem odbiera to, co miało się utrwalić. Lepiej przerwać naukę i się wyspać.',
    ],
    src: 'Yoo i in., Nature Neuroscience 2007; American Academy of Sleep Medicine',
  },
  {
    id: 'z-kroki', cat: 'zdrowie', topic: 'Mit dziesięciu tysięcy',
    teaser: 'Magiczne 10 tysięcy kroków wymyślił dział marketingu — badania pokazują inną granicę.',
    nums: [{ v: '4 400', l: 'kroków dziennie: już −41% ryzyka zgonu' }, { v: '~7 500', l: 'powyżej efekt się wypłaszcza' }],
    body: [
      'W 1965 r. w Japonii sprzedawano krokomierz „manpo-kei” — dosłownie „licznik 10 000 kroków”. Liczba była okrągła i łatwa do zapamiętania, nie wynikała z badań.',
      'W badaniu Lee i in. (JAMA Internal Medicine 2019, ~16 tys. kobiet) już 4 400 kroków dziennie wiązało się z ok. 41% niższą śmiertelnością niż 2 700. Korzyść rosła do ok. 7 500 kroków, potem stała w miejscu.',
      'Metaanaliza z Lancet Public Health (2022, 15 badań, ~47 tys. osób) wskazała próg ok. 6–8 tys. kroków dla osób po 60. i 8–10 tys. dla młodszych. Każde dodatkowe 1 000 kroków ma znaczenie — liczy się trend, nie magiczna liczba.',
    ],
    src: 'Lee i in., JAMA Intern Med 2019; Paluch i in., Lancet Public Health 2022',
  },
  {
    id: 'z-woda', cat: 'zdrowie', topic: 'Osiem szklanek wody',
    teaser: 'Słynne „8 szklanek dziennie” to źle przeczytane zalecenie sprzed 80 lat.',
    nums: [{ v: '2,0 / 2,5 L', l: 'wody dziennie (K / M) — ze wszystkich źródeł' }, { v: '20–30%', l: 'wody dostarcza samo jedzenie' }],
    body: [
      'W 1945 r. amerykańska Rada ds. Żywności zaleciła ok. 2,5 L wody dziennie, dodając: „większość tej ilości jest zawarta w przygotowanych posiłkach”. Druga część zdania z czasem zniknęła z obiegu.',
      'Europejski Urząd ds. Bezpieczeństwa Żywności (EFSA) podaje ok. 2,0 L dla kobiet i 2,5 L dla mężczyzn — ale łącznie z wodą z jedzenia (zupy, owoce, warzywa) oraz kawy i herbaty, które przy umiarkowanych ilościach nie odwadniają.',
      'Najprostszy wskaźnik: jasnosłomkowy kolor moczu. W upał i przy wysiłku potrzeba wyraźnie więcej.',
    ],
    src: 'EFSA, Dietary Reference Values for water (2010); US Food and Nutrition Board 1945',
  },
  {
    id: 'z-siedzenie', cat: 'zdrowie', topic: 'Antidotum na siedzenie',
    teaser: 'Godzina ruchu dziennie potrafi wyzerować ryzyko całego dnia za biurkiem.',
    nums: [{ v: '1 mln', l: 'osób w metaanalizie' }, { v: '60–75 min', l: 'umiarkowanego ruchu dziennie' }, { v: '8 h', l: 'siedzenia, którego ryzyko znika' }],
    body: [
      'Ekelund i współpracownicy (Lancet 2016) połączyli dane z 16 badań obejmujących ponad milion dorosłych. Ludzie siedzący ponad 8 godzin dziennie i mało aktywni mieli najwyższe ryzyko przedwczesnej śmierci.',
      'Ale u osób, które miały 60–75 minut umiarkowanego ruchu dziennie (szybki marsz, rower), podwyższone ryzyko związane z siedzeniem praktycznie znikało.',
      'Nie trzeba siłowni — liczą się spacery, dojazd rowerem, schody. Można też rozbijać ruch na kawałki w ciągu dnia.',
    ],
    src: 'Ekelund i in., The Lancet 2016',
  },
  {
    id: 'z-swiatlo-rano', cat: 'zdrowie', topic: 'Poranne światło',
    teaser: 'Nawet pochmurne niebo jest kilka razy jaśniejsze niż oświetlone biuro — i to ono nastawia twój zegar.',
    nums: [{ v: '1 000–10 000 lx', l: 'pochmurny dzień na zewnątrz' }, { v: '300–500 lx', l: 'typowe biuro' }, { v: '100 000 lx', l: 'pełne słońce' }],
    body: [
      'W siatkówce są komórki z melanopsyną, które nie służą do widzenia, tylko mierzą jasność i wysyłają sygnał do zegara biologicznego w podwzgórzu.',
      'Jasne światło rano przesuwa zegar wcześniej: łatwiej zasnąć wieczorem i wstać rano. Jasne światło wieczorem robi odwrotnie — hamuje melatoninę i opóźnia sen.',
      'Kilkanaście minut na dworze przed południem daje mózgowi więcej sygnału niż cały dzień przy biurowych lampach.',
    ],
    src: 'Przegląd: Blume i in., Somnologie 2019; normy oświetlenia PN-EN 12464-1',
  },
  {
    id: 'z-kofeina', cat: 'zdrowie', topic: 'Kofeina zostaje długo',
    teaser: 'Kawa wypita o 17:00 o 22:00 wciąż działa w połowie.',
    nums: [{ v: '~5 h', l: 'okres półtrwania kofeiny (zakres 2–10 h)' }, { v: '>1 h', l: 'mniej snu po kofeinie 6 h przed snem' }],
    body: [
      'Kofeina blokuje receptory adenozyny — cząsteczki, która przez cały dzień buduje „presję snu”. Po ok. 5 godzinach w organizmie zostaje połowa dawki, po 10 — ćwiartka.',
      'W badaniu Drake’a i in. (2013) 400 mg kofeiny (ok. 3–4 kawy) przyjęte nawet 6 godzin przed snem skróciło sen o ponad godzinę — a badani często nie zauważali, że śpią gorzej.',
      'Praktycznie: ostatnia kawa najlepiej przed 14:00–15:00, jeśli kładziesz się ok. 23:00.',
    ],
    src: 'Drake i in., Journal of Clinical Sleep Medicine 2013',
  },
  {
    id: 'z-sila-chwytu', cat: 'zdrowie', topic: 'Siła dłoni',
    teaser: 'Siła uścisku dłoni przewiduje ryzyko zgonu lepiej niż ciśnienie krwi.',
    nums: [{ v: '140 tys.', l: 'badanych w 17 krajach' }, { v: '+16%', l: 'ryzyka zgonu na każde −5 kg siły chwytu' }],
    body: [
      'Badanie PURE (Leong i in., Lancet 2015) śledziło przez 4 lata prawie 140 tysięcy dorosłych z 17 krajów. Każde 5 kg mniejszej siły chwytu wiązało się z o 16% wyższym ryzykiem zgonu z dowolnej przyczyny i o 17% z przyczyn sercowych.',
      'Siła chwytu okazała się mocniejszym predyktorem niż skurczowe ciśnienie krwi. Nie chodzi o same dłonie — to prosty miernik ogólnej masy i jakości mięśni.',
      'Mięśnie da się budować w każdym wieku: 2 treningi siłowe w tygodniu to minimum zalecane przez WHO.',
    ],
    src: 'Leong i in., The Lancet 2015 (PURE); WHO 2020',
  },
  {
    id: 'z-oddech', cat: 'zdrowie', topic: 'Westchnienie na stres',
    teaser: 'Pięć minut specjalnego oddychania dziennie poprawiło nastrój bardziej niż medytacja.',
    nums: [{ v: '5 min', l: 'dziennie przez miesiąc' }, { v: '~6', l: 'oddechów na minutę — „rezonans” serca' }],
    body: [
      'W badaniu Stanforda (Balban i in., Cell Reports Medicine 2023) 108 osób przez miesiąc ćwiczyło 5 minut dziennie. Najlepiej wypadło „cykliczne westchnienie”: dwa wdechy nosem (drugi krótki, dopełniający) i długi wydech ustami.',
      'Ta grupa miała największą poprawę nastroju i największy spadek częstości oddechu w spoczynku — większy niż grupa medytacji uważności.',
      'Mechanizm: długi wydech pobudza nerw błędny i układ przywspółczulny, a serce zwalnia. Oddech ok. 6 razy na minutę maksymalizuje zmienność rytmu serca (HRV).',
    ],
    src: 'Balban i in., Cell Reports Medicine 2023',
  },
  {
    id: 'z-cukier', cat: 'zdrowie', topic: 'Cukier w butelce',
    teaser: 'Jedna półlitrowa cola to ponad dwa razy więcej cukru, niż WHO uznaje za idealną dawkę na cały dzień.',
    nums: [{ v: '~53 g', l: 'cukru w 0,5 L coli (≈13 łyżeczek)' }, { v: '25 g', l: 'cel WHO: <5% energii dziennie' }, { v: '50 g', l: 'górny limit WHO: <10% energii' }],
    body: [
      'WHO zaleca, by cukry wolne (dodane + z soków i miodu) dawały mniej niż 10% energii, a najlepiej poniżej 5% — przy 2000 kcal to ok. 25 g.',
      'Klasyczna cola ma ok. 10,6 g cukru na 100 ml, więc butelka 0,5 L to ok. 53 g. Sok owocowy nie jest dużo lepszy: ok. 9–10 g na 100 ml.',
      'Płynny cukier nie syci — mózg nie „liczy” kalorii z napojów tak jak z jedzenia, więc łatwo je dokładać ponad potrzebę.',
    ],
    src: 'WHO Guideline: Sugars intake 2015',
  },
  {
    id: 'z-drzemka', cat: 'zdrowie', topic: 'Drzemka NASA',
    teaser: 'Piloci NASA po krótkiej drzemce byli o ponad połowę czujniejsi.',
    nums: [{ v: '26 min', l: 'średnia drzemka w badaniu' }, { v: '+34%', l: 'sprawności' }, { v: '+54%', l: 'czujności' }],
    body: [
      'W badaniu NASA (Rosekind i in., 1995) piloci długodystansowi dostawali 40 minut na drzemkę w kokpicie. Zasypiali średnio na 26 minut.',
      'W porównaniu z grupą bez drzemki ich sprawność wzrosła o 34%, a fizjologiczna czujność o 54% — mniej było mikrozaśnięć w końcówce lotu.',
      'Klucz to krótka drzemka (10–26 min), zanim mózg wejdzie w głęboki sen — wtedy nie ma „zamulenia” po przebudzeniu.',
    ],
    src: 'Rosekind i in., NASA Technical Memorandum 108839, 1995',
  },

  // ───────── MEDYCYNA ─────────
  {
    id: 'm-penicylina', cat: 'medycyna', topic: 'Pleśń Fleminga',
    teaser: 'Najważniejszy lek XX wieku wyrósł na brudnej szalce, której ktoś nie umył przed urlopem.',
    nums: [{ v: '1928', l: 'odkrycie penicyliny' }, { v: '2,3 mln', l: 'dawek gotowych na D-Day (1944)' }],
    body: [
      'Alexander Fleming wrócił z wakacji we wrześniu 1928 r. i zauważył, że wokół pleśni Penicillium na szalce z gronkowcami bakterie zniknęły.',
      'Przez ponad 10 lat nikt nie umiał tego wyprodukować. Dopiero Howard Florey i Ernst Chain w Oksfordzie (1940) oczyścili penicylinę i pokazali, że leczy zakażenia. Na lądowanie w Normandii w 1944 r. przygotowano ok. 2,3 mln dawek.',
      'W 1945 r. cała trójka dostała Nagrodę Nobla. Przed antybiotykami zwykłe zadrapanie czy zapalenie płuc potrafiło zabić.',
    ],
    src: 'Nobel Prize 1945; American Chemical Society, National Historic Chemical Landmark',
  },
  {
    id: 'm-ospa', cat: 'medycyna', topic: 'Koniec ospy',
    teaser: 'Choroba, która w XX wieku zabiła więcej ludzi niż wszystkie wojny razem, dziś istnieje tylko w dwóch zamrażarkach.',
    nums: [{ v: '~300 mln', l: 'zgonów w XX wieku' }, { v: '1977', l: 'ostatni naturalny przypadek' }, { v: '1980', l: 'WHO ogłasza eradykację' }],
    body: [
      'Ospa prawdziwa zabijała ok. 30% zakażonych. Szacuje się, że w samym XX wieku odpowiadała za ok. 300 milionów zgonów.',
      'WHO od 1967 r. prowadziło kampanię „szczepienia pierścieniowego”: zamiast szczepić wszystkich, szczepiono otoczenie każdego chorego. Ostatni naturalny przypadek: Ali Maow Maalin, Somalia, 1977.',
      'W 1980 r. ospę ogłoszono wytępioną — to jedyna ludzka choroba, której się to udało. Próbki wirusa są oficjalnie tylko w dwóch laboratoriach: w USA i Rosji.',
    ],
    src: 'WHO, Smallpox eradication; Henderson, Vaccine 2011',
  },
  {
    id: 'm-mrna', cat: 'medycyna', topic: 'Szczepionki mRNA',
    teaser: 'Projekt szczepionki na COVID powstał w 2 dni — ale wymagał 15 lat odrzucanej pracy.',
    nums: [{ v: '95%', l: 'skuteczność w badaniu fazy 3' }, { v: '43 tys.', l: 'uczestników badania' }, { v: '2 dni', l: 'od sekwencji wirusa do projektu' }],
    body: [
      'Katalin Karikó i Drew Weissman w 2005 r. odkryli, że zamiana jednej „litery” w mRNA (urydyny na pseudourydynę) sprawia, że organizm nie atakuje go jako intruza. Przez lata ich prace odrzucały czasopisma i grantodawcy.',
      'Gdy 11 stycznia 2020 r. opublikowano sekwencję koronawirusa, Moderna miała projekt szczepionki już 13 stycznia. Badanie fazy 3 Pfizer/BioNTech na ok. 43 tys. osób pokazało 95% skuteczności przeciw objawowej chorobie.',
      'W 2023 r. Karikó i Weissman dostali Nobla z medycyny. Ta sama technologia jest dziś testowana w szczepionkach przeciw nowotworom.',
    ],
    src: 'Nobel Prize 2023; Polack i in., NEJM 2020',
  },
  {
    id: 'm-crispr', cat: 'medycyna', topic: 'Nożyczki do genów',
    teaser: 'W 2023 r. po raz pierwszy zatwierdzono lek, który poprawia DNA pacjenta — i wyleczył prawie wszystkich badanych.',
    nums: [{ v: '2023', l: 'pierwsza terapia CRISPR (Casgevy)' }, { v: '29 z 31', l: 'pacjentów bez kryzysów bólowych przez ≥12 mies.' }],
    body: [
      'CRISPR-Cas9 to bakteryjny system obronny, który Jennifer Doudna i Emmanuelle Charpentier (Nobel 2020) zamieniły w precyzyjne nożyczki do DNA.',
      'Casgevy leczy anemię sierpowatą: komórki szpiku pacjenta są pobierane, edytowane tak, by produkowały hemoglobinę płodową, i podawane z powrotem. W badaniu 29 z 31 pacjentów przez co najmniej rok nie miało ani jednego ciężkiego kryzysu bólowego.',
      'Zatwierdzenie: Wielka Brytania (listopad 2023), USA (grudzień 2023). Na razie terapia kosztuje ok. 2 mln dolarów za pacjenta.',
    ],
    src: 'FDA, 8.12.2023; Frangoul i in., NEJM 2024',
  },
  {
    id: 'm-placebo', cat: 'medycyna', topic: 'Jawne placebo',
    teaser: 'Placebo działa nawet wtedy, gdy pacjent wie, że to tylko cukier.',
    nums: [{ v: '59%', l: 'poprawy w grupie „jawnego placebo”' }, { v: '35%', l: 'poprawy bez żadnych tabletek' }],
    body: [
      'Ted Kaptchuk z Harvardu (2010) dał pacjentom z zespołem jelita drażliwego tabletki z napisem „placebo” i powiedział wprost: w środku nie ma leku, ale badania pokazują, że rytuał przyjmowania może pomagać.',
      'Po 3 tygodniach odpowiednią ulgę zgłosiło 59% osób z placebo wobec 35% w grupie bez tabletek. Podobne wyniki powtórzono później przy przewlekłym bólu pleców.',
      'Placebo nie zmniejsza guzów ani nie zabija bakterii, ale realnie wpływa na odczuwanie bólu, zmęczenia czy dolegliwości jelitowych.',
    ],
    src: 'Kaptchuk i in., PLoS ONE 2010; Carvalho i in., Pain 2016',
  },
  {
    id: 'm-watroba', cat: 'medycyna', topic: 'Wątroba odrasta',
    teaser: 'Możesz oddać ponad połowę wątroby — a po kilku tygodniach będzie prawie jak nowa.',
    nums: [{ v: '~30%', l: 'wątroby wystarczy, by odrosła' }, { v: '~8 tyg.', l: 'do niemal pełnej objętości' }],
    body: [
      'Wątroba to jedyny narząd wewnętrzny człowieka, który odbudowuje utraconą masę. Po usunięciu nawet ok. 70% zdrowej wątroby pozostałe komórki zaczynają się dzielić w ciągu dni.',
      'Na tym opiera się przeszczep od żywego dawcy: dawca oddaje część narządu, a u obojga — dawcy i biorcy — wątroba w ciągu kilku tygodni wraca do niemal pełnej objętości.',
      'Grecy jakby to przeczuwali: w micie orzeł codziennie wyjadał Prometeuszowi wątrobę, a ta w nocy odrastała.',
    ],
    src: 'Michalopoulos, Hepatology 2017',
  },
  {
    id: 'm-opornosc', cat: 'medycyna', topic: 'Bakterie oporne',
    teaser: 'Bakterie odporne na antybiotyki zabijają rocznie więcej ludzi niż HIV i malaria.',
    nums: [{ v: '1,27 mln', l: 'zgonów bezpośrednio (2019)' }, { v: '4,95 mln', l: 'zgonów, w których oporność miała udział' }],
    body: [
      'Badanie GRAM (The Lancet, 2022) policzyło, że w 2019 r. oporność bakterii bezpośrednio spowodowała 1,27 mln zgonów, a przyczyniła się do 4,95 mln. To więcej niż HIV (ok. 860 tys.) czy malaria (ok. 640 tys.).',
      'Każde użycie antybiotyku daje przewagę bakteriom, które przypadkiem przeżyły. Zwłaszcza szkodzi branie antybiotyków na infekcje wirusowe (przeziębienie, grypa), gdzie i tak nie działają.',
      'Nowych klas antybiotyków prawie nie przybywa — ostatnią nową klasę odkryto pod koniec lat 80.',
    ],
    src: 'Antimicrobial Resistance Collaborators, The Lancet 2022',
  },
  {
    id: 'm-rtg', cat: 'medycyna', topic: 'Pierwsze prześwietlenie',
    teaser: 'Pierwsze zdjęcie rentgenowskie w historii przedstawia dłoń żony odkrywcy — z obrączką.',
    nums: [{ v: '1895', l: 'odkrycie promieni X' }, { v: '1901', l: 'pierwszy Nobel z fizyki' }],
    body: [
      'Wilhelm Röntgen badał lampy katodowe, gdy zauważył, że ekran w ciemnym pokoju świeci, choć lampa była przykryta. Nazwał nieznane promienie „X”.',
      'Dwa tygodnie później zrobił zdjęcie dłoni swojej żony Anny Berthy — widać kości i obrączkę. Podobno powiedziała: „Widziałam swoją śmierć”.',
      'Röntgen dostał pierwszą w historii Nagrodę Nobla z fizyki (1901) i celowo nie opatentował odkrycia, żeby każdy szpital mógł z niego korzystać.',
    ],
    src: 'Nobel Prize 1901; Deutsches Röntgen-Museum',
  },
  {
    id: 'm-serce', cat: 'medycyna', topic: 'Pompa w piersi',
    teaser: 'Twoje serce dziennie przepompowuje tyle krwi, że napełniłoby nią cysternę.',
    nums: [{ v: '~100 tys.', l: 'uderzeń na dobę' }, { v: '~7 000 L', l: 'krwi dziennie' }, { v: '~3 mld', l: 'uderzeń w ciągu życia' }],
    body: [
      'Serce w spoczynku tłoczy ok. 5 litrów krwi na minutę — to prawie cała krew w ciele co minutę. Dziennie daje to ok. 7 000 litrów.',
      'Przy ok. 70 uderzeniach na minutę wychodzi ok. 100 tysięcy uderzeń na dobę i 2,5–3 miliardy w ciągu życia.',
      'Komórki mięśnia sercowego prawie się nie odnawiają — u dorosłego wymienia się mniej niż 1% rocznie. Dlatego zawał zostawia trwałą bliznę.',
    ],
    src: 'Bergmann i in., Science 2009; podręczniki fizjologii (Guyton & Hall)',
  },
  {
    id: 'm-insulina', cat: 'medycyna', topic: 'Patent za dolara',
    teaser: 'Wynalazcy insuliny sprzedali patent za 1 dolara, bo uważali, że lek ratujący życie powinien należeć do wszystkich.',
    nums: [{ v: '1922', l: 'pierwszy pacjent leczony insuliną' }, { v: '1 $', l: 'cena patentu' }],
    body: [
      'Przed insuliną cukrzyca typu 1 była wyrokiem: dzieci umierały w ciągu miesięcy, a jedynym „leczeniem” była skrajna głodówka.',
      'W styczniu 1922 r. w Toronto 14-letni Leonard Thompson dostał pierwszy zastrzyk oczyszczonej insuliny. Jego poziom cukru spadł, a chłopiec przeżył kolejne 13 lat.',
      'Frederick Banting, Charles Best i James Collip sprzedali patent Uniwersytetowi w Toronto za symbolicznego dolara każdy. Banting powiedział: „Insulina nie należy do mnie, należy do świata”.',
    ],
    src: 'University of Toronto, Discovery of Insulin; Nobel Prize 1923',
  },

  // ───────── MATERIAŁY ─────────
  {
    id: 'mat-grafen', cat: 'materialy', topic: 'Grafen z taśmy',
    teaser: 'Najmocniejszy znany materiał odkryto przy pomocy zwykłej taśmy klejącej.',
    nums: [{ v: '0,34 nm', l: 'grubość — jeden atom' }, { v: '~130 GPa', l: 'wytrzymałość na rozciąganie' }, { v: '2010', l: 'Nobel z fizyki' }],
    body: [
      'Andre Geim i Konstantin Novoselov w 2004 r. odrywali taśmą warstwy z grafitu (jak w ołówku), aż zostawała pojedyncza warstwa atomów węgla ułożonych w sześciokąty.',
      'Grafen ma wytrzymałość ok. 130 GPa — kilkadziesiąt do kilkuset razy więcej niż stal (zależnie od gatunku) — i świetnie przewodzi ciepło i prąd. Nobel przyszedł już w 2010 r.',
      'Geim jest jedynym człowiekiem z Noblem i satyrycznym Ig Noblem: ten drugi dostał w 2000 r. za lewitującą w polu magnetycznym żabę.',
    ],
    src: 'Lee i in., Science 2008; Nobel Prize 2010',
  },
  {
    id: 'mat-beton-rzymski', cat: 'materialy', topic: 'Samoleczący się beton',
    teaser: 'Rzymski beton sam łata swoje pęknięcia — dlatego Panteon stoi od prawie 1900 lat.',
    nums: [{ v: '43,3 m', l: 'średnica kopuły Panteonu' }, { v: '~1900 lat', l: 'bez zbrojenia' }],
    body: [
      'Badacze z MIT (Seymour i in., Science Advances 2023) zauważyli w rzymskim betonie białe grudki wapna, które wcześniej brano za błąd mieszania.',
      'Okazało się, że Rzymianie mieszali beton „na gorąco” z wapnem palonym. Gdy pojawia się rysa i wnika woda, grudki rozpuszczają się i krystalizuje węglan wapnia, który zamyka pęknięcie.',
      'Kopuła Panteonu (43,3 m) to wciąż największa na świecie kopuła z niezbrojonego betonu. Badacze testują tę metodę w nowoczesnym betonie.',
    ],
    src: 'Seymour i in., Science Advances 2023',
  },
  {
    id: 'mat-aerozel', cat: 'materialy', topic: 'Zamrożony dym',
    teaser: 'Materiał, który w ponad 99% jest powietrzem, złapał pył z warkocza komety.',
    nums: [{ v: '99,8%', l: 'objętości to powietrze' }, { v: '2006', l: 'próbki komety wróciły na Ziemię' }],
    body: [
      'Aerożel krzemionkowy powstaje, gdy z żelu usuwa się ciecz tak delikatnie, że szkielet zostaje. Wygląda jak niebieskawy dym i jest jednym z najlepszych izolatorów cieplnych.',
      'NASA w misji Stardust użyła bloków aerożelu jak siatki: w 2004 r. sonda przeleciała przez warkocz komety Wild 2, a cząstki pyłu lecące z prędkością ok. 6 km/s wyhamowały w aerożelu bez spalenia. Kapsuła wróciła w 2006 r.',
      'Kilka centymetrów aerożelu chroni przed palnikiem — kwiat położony na nim nie więdnie.',
    ],
    src: 'NASA Stardust mission; NASA JPL',
  },
  {
    id: 'mat-szklo-tel', cat: 'materialy', topic: 'Szkło w telefonie',
    teaser: 'Szybka twojego telefonu jest mocniejsza, bo kąpano ją w stopionej soli.',
    nums: [{ v: '~400 °C', l: 'kąpiel w stopionym azotanie potasu' }, { v: '2007', l: 'pierwszy telefon z takim szkłem' }],
    body: [
      'Szkło hartowane chemicznie zanurza się w stopionej soli potasowej. Duże jony potasu wchodzą w miejsce mniejszych jonów sodu na powierzchni i „wciskają się” ciasno.',
      'Powstaje warstwa ściśnięta jak sprężyna — żeby pęknięcie się zaczęło, najpierw musi pokonać to ściskanie. Corning opracował metodę w latach 60. (projekt Chemcor), ale masowo trafiła do telefonów w 2007 r.',
      'Dlatego szkło telefonu częściej pęka od uderzenia w krawędź niż od nacisku na środek.',
    ],
    src: 'Corning Inc., historia Gorilla Glass; Varshneya, Int. J. Applied Glass Science 2010',
  },
  {
    id: 'mat-aluminium', cat: 'materialy', topic: 'Metal dla cesarza',
    teaser: 'Aluminium było kiedyś tak cenne, że najważniejsi goście Napoleona III jedli aluminiowymi sztućcami, a reszta złotymi.',
    nums: [{ v: '1886', l: 'tania metoda elektrolizy' }, { v: '~5%', l: 'energii potrzeba na recykling' }],
    body: [
      'Aluminium to najczęstszy metal w skorupie ziemskiej, ale trudno go oddzielić od tlenu. W XIX w. było droższe od złota — w 1884 r. czubek pomnika Waszyngtona odlano z ok. 2,8 kg aluminium jako symbolu luksusu.',
      'W 1886 r. Charles Hall i Paul Héroult niezależnie wymyślili elektrolizę tlenku glinu w stopionym kriolicie. Cena spadła tak bardzo, że aluminium stało się materiałem na puszki.',
      'Recykling aluminium wymaga tylko ok. 5% energii potrzebnej do produkcji z rudy — dlatego zbieranie puszek naprawdę ma sens.',
    ],
    src: 'American Chemical Society; International Aluminium Institute',
  },
  {
    id: 'mat-pajeczyna', cat: 'materialy', topic: 'Najmocniejsza pajęczyna',
    teaser: 'Nić pewnego pająka z Madagaskaru pochłania 10 razy więcej energii przed zerwaniem niż kevlar.',
    nums: [{ v: '~350 MJ/m³', l: 'wiązkość nici C. darwini' }, { v: '10×', l: 'więcej niż kevlar' }, { v: '25 m', l: 'długość sieci nad rzeką' }],
    body: [
      'Pająk Caerostris darwini rozciąga sieci nad rzekami — linie kotwiczne mają do 25 metrów. Agnarsson i in. (2010) zmierzyli, że jego nić ma wiązkość (energię pochłanianą do zerwania) ok. 350 MJ/m³.',
      'To ok. dwa razy więcej niż u innych pająków i ok. 10 razy więcej niż kevlar w kamizelkach kuloodpornych. Nić jest jednocześnie mocna i bardzo rozciągliwa.',
      'Firmy próbują produkować pajęczy jedwab przez bakterie i drożdże, bo pająków nie da się hodować jak jedwabników — zjadają się nawzajem.',
    ],
    src: 'Agnarsson i in., PLoS ONE 2010',
  },
  {
    id: 'mat-nitinol', cat: 'materialy', topic: 'Metal z pamięcią',
    teaser: 'Zgnieciony drut z nitinolu w ciepłej wodzie sam wraca do dawnego kształtu.',
    nums: [{ v: '~8%', l: 'odkształcenia wraca bez śladu' }, { v: '~0,5%', l: 'to samo dla zwykłej stali' }],
    body: [
      'Nitinol to stop niklu i tytanu, odkryty w amerykańskim Naval Ordnance Laboratory (stąd nazwa: Ni-Ti-NOL). Ma dwie struktury krystaliczne i przełącza się między nimi zależnie od temperatury.',
      'Dzięki temu można go odkształcić nawet o ok. 8%, a po ogrzaniu wraca do zapamiętanego kształtu. Stal przy ok. 0,5% odkształca się już trwale.',
      'Najważniejsze użycie: stenty naczyniowe. Ściśnięty stent wprowadza się cewnikiem, a w temperaturze ciała sam się rozpręża i otwiera tętnicę.',
    ],
    src: 'Buehler i in., J. Applied Physics 1963; Duerig i in., Materials Science and Engineering A 1999',
  },
  {
    id: 'mat-krzem', cat: 'materialy', topic: 'Polak w chipach',
    teaser: 'Prawie każdy procesor na świecie zaczyna się od metody, którą polski chemik odkrył przez pomyłkę.',
    nums: [{ v: '1916', l: 'metoda Czochralskiego' }, { v: '99,9999999%', l: 'czystość krzemu do chipów' }],
    body: [
      'Jan Czochralski w 1916 r. zamiast pióra w atramencie zanurzył je w tyglu ze stopioną cyną. Wyciągnął cienki pręt metalu — pojedynczy kryształ.',
      'Dziś tą metodą wyciąga się z roztopionego krzemu walce monokryształu o średnicy 300 mm i wadze kilkuset kilogramów. Kroi się je na wafle, z których powstają procesory.',
      'Krzem do elektroniki musi być czysty w 99,9999999% (tzw. „dziewięć dziewiątek”) i więcej — na miliard atomów najwyżej jeden obcy.',
    ],
    src: 'Tomaszewski, Journal of Crystal Growth 2002; SEMI standards',
  },
  {
    id: 'mat-tytan', cat: 'materialy', topic: 'Tytan zrasta się',
    teaser: 'Implanty zębowe istnieją, bo szwedzki naukowiec nie mógł odczepić tytanowej kamery od kości królika.',
    nums: [{ v: '1952', l: 'odkrycie osteointegracji' }, { v: '4,5 g/cm³', l: 'gęstość tytanu (stal: 7,9)' }],
    body: [
      'Per-Ingvar Brånemark wkręcał tytanowe komory w kości królików, by obserwować krążenie. Po zakończeniu badań nie dało się ich wyjąć — kość zrosła się z metalem.',
      'To zjawisko nazwał osteointegracją. W 1965 r. pierwszy pacjent dostał tytanowe implanty zębów — działały ponad 40 lat.',
      'Tytan jest prawie dwa razy lżejszy od stali, nie koroduje w organizmie i pokrywa się cienką warstwą tlenku, którą komórki kości „akceptują”.',
    ],
    src: 'Brånemark, J. Prosthetic Dentistry 1983',
  },
  {
    id: 'mat-diament', cat: 'materialy', topic: 'Diament przemija powoli',
    teaser: 'Diament w temperaturze pokojowej powinien zamienić się w grafit — tylko trwałoby to dłużej niż wiek wszechświata.',
    nums: [{ v: '~2 000 W/mK', l: 'przewodność cieplna (miedź: ~400)' }, { v: '1954', l: 'pierwszy syntetyczny diament' }],
    body: [
      'W zwykłych warunkach trwalszą formą węgla jest grafit. Diament jest „metastabilny”: przemiana wymaga tak dużej energii, że praktycznie nie zachodzi.',
      'Diament przewodzi ciepło ok. 5 razy lepiej niż miedź, bo jego sztywna sieć atomów świetnie przenosi drgania. Dlatego testery jubilerskie sprawdzają przewodność ciepła.',
      'General Electric wyprodukował syntetyczny diament w 1954 r. Dziś diamenty z laboratorium są chemicznie identyczne z naturalnymi.',
    ],
    src: 'Wei i in., Physical Review Letters 1993; GE Research',
  },

  // ───────── KOSMOS ─────────
  {
    id: 'k-swiatlo-slonca', cat: 'kosmos', topic: 'Stare światło Słońca',
    teaser: 'Światło Słońca leci do nas 8 minut — ale wydostanie się z jego wnętrza zajęło mu dziesiątki tysięcy lat.',
    nums: [{ v: '8 min 20 s', l: 'lot światła ze Słońca do Ziemi' }, { v: '10–170 tys. lat', l: 'droga energii z jądra na powierzchnię' }],
    body: [
      'Ze Słońca do Ziemi jest średnio 150 mln km, więc światło leci ok. 8 minut i 20 sekund.',
      'Ale energia powstaje w jądrze Słońca. Tam materia jest tak gęsta, że foton przelatuje ułamek milimetra, jest pochłaniany i wysyłany w losowym kierunku. Takie „błądzenie” trwa według różnych szacunków od 10 do 170 tysięcy lat.',
      'Ciepło, które czujesz dziś na twarzy, powstało w jądrze Słońca jeszcze przed wynalezieniem rolnictwa.',
    ],
    src: 'NASA; Mitalas & Sills, Astrophysical Journal 1992',
  },
  {
    id: 'k-iss', cat: 'kosmos', topic: '16 wschodów dziennie',
    teaser: 'Astronauci na ISS widzą 16 wschodów i 16 zachodów Słońca w ciągu jednej doby.',
    nums: [{ v: '~28 000 km/h', l: 'prędkość ISS' }, { v: '~92 min', l: 'jedno okrążenie Ziemi' }, { v: '~400 km', l: 'wysokość orbity' }],
    body: [
      'Międzynarodowa Stacja Kosmiczna leci z prędkością ok. 7,7 km/s, czyli ok. 28 000 km/h. Z Warszawy do Krakowa doleciałaby w ok. 35 sekund.',
      'Jedno okrążenie zajmuje ok. 92 minuty, więc w ciągu doby wypada ok. 16 wschodów i zachodów. Załoga żyje według czasu Greenwich i zasłania okna do snu.',
      'ISS jest tylko ok. 400 km nad Ziemią — mniej niż z Warszawy do Szczecina w linii prostej. W dobrych warunkach widać ją gołym okiem jako szybko lecącą jasną kropkę.',
    ],
    src: 'NASA, ISS Facts and Figures',
  },
  {
    id: 'k-wenus', cat: 'kosmos', topic: 'Najdłuższa doba Wenus',
    teaser: 'Na Wenus szybciej mija rok niż jedna doba — a Słońce wschodzi na zachodzie.',
    nums: [{ v: '243 dni', l: 'jeden obrót wokół osi' }, { v: '225 dni', l: 'jeden rok' }, { v: '465 °C', l: 'temperatura powierzchni' }],
    body: [
      'Wenus obraca się wokół osi raz na 243 ziemskie dni, a wokół Słońca okrąża w 225 dni. Do tego kręci się „do tyłu” niż prawie wszystkie planety, więc Słońce wschodzi tam na zachodzie.',
      'To najgorętsza planeta Układu Słonecznego (ok. 465 °C) — gorętsza niż Merkury, choć jest dwa razy dalej od Słońca. Gęsta atmosfera z CO₂ działa jak ekstremalna szklarnia.',
      'Ciśnienie na powierzchni to ok. 92 atmosfery — jak na głębokości 900 m w oceanie. Radzieckie lądowniki Wenera przetrwały tam najwyżej ok. 2 godziny.',
    ],
    src: 'NASA Venus Fact Sheet',
  },
  {
    id: 'k-voyager', cat: 'kosmos', topic: 'Dzień świetlny Voyagera',
    teaser: 'Właśnie teraz sonda z 1977 r. staje się pierwszym obiektem ludzi oddalonym od Ziemi o cały dzień świetlny.',
    nums: [{ v: '1977', l: 'start Voyagera 1' }, { v: '~17 km/s', l: 'prędkość względem Słońca' }, { v: '~25,9 mld km', l: 'jeden dzień świetlny' }],
    body: [
      'Voyager 1 wystartował we wrześniu 1977 r. i w 2012 r. jako pierwszy opuścił heliosferę — „bańkę” wiatru słonecznego.',
      'Leci ok. 17 km/s. Według NASA pod koniec 2026 r. przekroczy odległość jednego dnia świetlnego (ok. 25,9 mld km): sygnał radiowy wysłany do sondy dociera do niej po 24 godzinach, a odpowiedź wraca po kolejnych 24.',
      'Komputer sondy ma ok. 70 KB pamięci, a nadajnik ok. 22 W — tyle co słaba żarówka. Mimo to wciąż wysyła dane.',
    ],
    src: 'NASA JPL, Voyager mission status',
  },
  {
    id: 'k-neutronowa', cat: 'kosmos', topic: 'Łyżeczka gwiazdy',
    teaser: 'Łyżeczka materii z gwiazdy neutronowej ważyłaby tyle, co wszyscy ludzie na Ziemi razy kilka.',
    nums: [{ v: '~20 km', l: 'średnica gwiazdy' }, { v: '1,4 M☉', l: 'masa (1,4 Słońca)' }, { v: '716/s', l: 'rekordowe obroty pulsara' }],
    body: [
      'Gwiazda neutronowa to jądro gwiazdy, która wybuchła jako supernowa. Masa większa od Słońca jest ściśnięta do kuli o średnicy ok. 20 km — wielkości miasta.',
      'Gęstość jest taka, że łyżeczka tej materii (5 ml) ważyłaby ok. 2–3 miliardów ton — kilka razy więcej niż cała ludzkość (ok. 0,5 mld ton).',
      'Niektóre gwiazdy neutronowe wirują jak bąki. Rekordzista PSR J1748−2446ad obraca się 716 razy na sekundę — jego równik pędzi z prędkością ponad 40 000 km/s.',
    ],
    src: 'NASA Goddard; Hessels i in., Science 2006',
  },
  {
    id: 'k-ksiezyc', cat: 'kosmos', topic: 'Księżyc odpływa',
    teaser: 'Księżyc co roku oddala się od nas mniej więcej o tyle, ile rosną twoje paznokcie.',
    nums: [{ v: '3,8 cm', l: 'oddalania się rocznie' }, { v: '1969', l: 'pierwsze lustra na Księżycu (Apollo 11)' }],
    body: [
      'Astronauci Apollo 11, 14 i 15 zostawili na Księżycu lustra-retroreflektory. Obserwatoria na Ziemi strzelają w nie laserem i mierzą czas powrotu światła z dokładnością do milimetrów.',
      'Pomiary pokazują, że Księżyc oddala się ok. 3,8 cm rocznie. Przyczyną są pływy: Księżyc spowalnia obrót Ziemi, a ona w zamian „wypycha” go na wyższą orbitę.',
      'Za kilkaset milionów lat Księżyc będzie za mały na niebie, żeby całkowicie zasłonić Słońce — skończą się całkowite zaćmienia.',
    ],
    src: 'NASA Lunar Laser Ranging; Williams & Boggs, J. Geodesy 2016',
  },
  {
    id: 'k-mars', cat: 'kosmos', topic: 'Niebieski zachód Marsa',
    teaser: 'Na czerwonej planecie zachody Słońca są niebieskie.',
    nums: [{ v: '24 h 40 min', l: 'doba na Marsie (sol)' }, { v: '~−60 °C', l: 'średnia temperatura' }],
    body: [
      'Atmosfera Marsa jest pełna drobnego pyłu z tlenkami żelaza. Za dnia rozprasza światło tak, że niebo jest żółto-brązowe.',
      'O zachodzie, gdy światło przechodzi przez grubszą warstwę atmosfery, pył mocniej przepuszcza światło niebieskie w kierunku jego biegu. Wokół Słońca pojawia się niebieska poświata — łaziki Spirit i Curiosity ją sfotografowały.',
      'Doba na Marsie trwa ok. 24 h 40 min. Zespoły łazików przez pierwsze miesiące pracują na „czasie marsjańskim” i co dzień przesuwają pobudkę o 40 minut.',
    ],
    src: 'NASA JPL, Curiosity/Spirit imaging',
  },
  {
    id: 'k-jwst', cat: 'kosmos', topic: 'Złote lustro Webba',
    teaser: 'Lustro największego teleskopu kosmicznego pokrywa złoto o wadze mniejszej niż piłka golfowa.',
    nums: [{ v: '6,5 m', l: 'średnica lustra (18 segmentów)' }, { v: '~48 g', l: 'złota na całym lustrze' }, { v: '1,5 mln km', l: 'od Ziemi (punkt L2)' }],
    body: [
      'Teleskop Jamesa Webba ma lustro z 18 sześciokątnych segmentów z berylu. Pokryto je warstwą złota grubą ok. 100 nm, bo złoto najlepiej odbija podczerwień — łącznie ok. 48 gramów.',
      'Webb krąży wokół punktu L2, ok. 1,5 mln km od Ziemi. Osłona przeciwsłoneczna wielkości kortu tenisowego chłodzi instrumenty do ok. −230 °C.',
      'Wystartował 25 grudnia 2021 r. Widzi galaktyki, których światło wyruszyło ponad 13 mld lat temu.',
    ],
    src: 'NASA / ESA, James Webb Space Telescope',
  },
  {
    id: 'k-gwiazdy-w-nas', cat: 'kosmos', topic: 'Jesteśmy pyłem gwiazd',
    teaser: 'Większość atomów w twoim ciele ma prawie 14 miliardów lat.',
    nums: [{ v: '~62%', l: 'atomów w ciele to wodór' }, { v: '13,8 mld lat', l: 'wiek wodoru (Wielki Wybuch)' }],
    body: [
      'Wodór powstał w ciągu kilku minut po Wielkim Wybuchu, 13,8 mld lat temu. Licząc same atomy, ok. 62% atomów w ciele człowieka to właśnie wodór — głównie w wodzie.',
      'Węgiel, tlen, azot czy wapń powstały później we wnętrzach gwiazd. Gdy gwiazdy umierały, rozsiewały je w kosmos, a z tej materii powstał Układ Słoneczny.',
      'Cięższe pierwiastki, np. złoto i jod, powstały najpewniej w zderzeniach gwiazd neutronowych i wybuchach supernowych.',
    ],
    src: 'Johnson, Science 2019 (układ okresowy pochodzenia pierwiastków); NASA',
  },
  {
    id: 'k-slady-ksiezyc', cat: 'kosmos', topic: 'Ślady na zawsze',
    teaser: 'Ślady butów astronautów na Księżycu mogą przetrwać miliony lat.',
    nums: [{ v: '12', l: 'ludzi chodziło po Księżycu' }, { v: '1969–1972', l: 'misje Apollo' }],
    body: [
      'Na Księżycu nie ma wiatru, deszczu ani życia, które zatarłyby ślady. Powierzchnię zmieniają głównie mikrometeoryty — bardzo powoli.',
      'Regolit, czyli księżycowy pył, ma ostre ziarna (nie są szlifowane przez wodę ani wiatr), więc ślady bardzo dobrze trzymają kształt.',
      'Między 1969 a 1972 r. po Księżycu chodziło 12 astronautów. Sonda LRO z orbity sfotografowała ich ścieżki i lądowniki jeszcze po 40 latach.',
    ],
    src: 'NASA Lunar Reconnaissance Orbiter',
  },

  // ───────── ŚWIAT WOKÓŁ ─────────
  {
    id: 's-tlen-ocean', cat: 'swiat', topic: 'Oddech z oceanu',
    teaser: 'Co drugi wdech zawdzięczasz mikroskopijnym organizmom w oceanie, nie lasom.',
    nums: [{ v: '~50%', l: 'tlenu na Ziemi z oceanu' }, { v: 'do 20%', l: 'robi jedna bakteria: Prochlorococcus' }],
    body: [
      'Fitoplankton — glony i sinice unoszące się przy powierzchni oceanu — fotosyntezują jak rośliny. Według NOAA odpowiadają za ok. połowę produkcji tlenu na Ziemi.',
      'Najmniejszy z nich, Prochlorococcus, to najliczniejszy organizm fotosyntetyczny na planecie. Sam może wytwarzać do 20% tlenu biosfery.',
      'Odkryto go dopiero w 1986 r., bo jest tak mały (ok. 0,6 µm), że przelatywał przez filtry badaczy.',
    ],
    src: 'NOAA Ocean Service; Chisholm i in., Nature 1988',
  },
  {
    id: 's-piorun', cat: 'swiat', topic: 'Gorętszy niż Słońce',
    teaser: 'Kanał błyskawicy nagrzewa się 5 razy bardziej niż powierzchnia Słońca.',
    nums: [{ v: '~30 000 °C', l: 'temperatura kanału pioruna' }, { v: '~5 500 °C', l: 'powierzchnia Słońca' }, { v: '~44/s', l: 'wyładowań na całej Ziemi' }],
    body: [
      'Powietrze w kanale pioruna nagrzewa się w ułamku sekundy do ok. 30 000 °C. Gwałtownie się rozszerza i tworzy falę uderzeniową — to grzmot.',
      'Satelity NASA liczą ok. 44 wyładowania na sekundę na całej Ziemi, czyli ok. 1,4 mld rocznie. Najwięcej nad jeziorem Maracaibo w Wenezueli.',
      'Lifehack: dźwięk leci ok. 1 km w 3 sekundy. Policz sekundy od błysku do grzmotu i podziel przez 3 — masz odległość w km.',
    ],
    src: 'NOAA National Severe Storms Laboratory; NASA LIS/OTD',
  },
  {
    id: 's-drzewa', cat: 'swiat', topic: 'Trzy biliony drzew',
    teaser: 'Na Ziemi rośnie ok. 400 drzew na każdego człowieka — i jest ich prawie połowę mniej niż na początku rolnictwa.',
    nums: [{ v: '~3 bln', l: 'drzew na Ziemi (3 × 10¹²)' }, { v: '~422', l: 'drzew na człowieka' }, { v: '−46%', l: 'od początku rolnictwa' }],
    body: [
      'Crowther i in. (Nature 2015) połączyli zdjęcia satelitarne z pomiarami z 430 tys. poletek i policzyli drzewa na całej planecie: ok. 3,04 biliona.',
      'Wcześniejsze szacunki mówiły o 400 miliardach — prawie 8 razy za mało. Na osobę wypada ok. 422 drzew.',
      'Ludzie wycinają rocznie ok. 15 miliardów drzew, a od początku rolnictwa liczba drzew spadła o ok. 46%.',
    ],
    src: 'Crowther i in., Nature 2015',
  },
  {
    id: 's-grzyby', cat: 'swiat', topic: 'Grzyby to krewni',
    teaser: 'Grzyby są bliżej spokrewnione z tobą niż z roślinami.',
    nums: [{ v: '~9,6 km²', l: 'największy organizm: opieńka w Oregonie' }, { v: '2,4–8,6 tys. lat', l: 'jej szacowany wiek' }],
    body: [
      'Analizy DNA pokazują, że grzyby i zwierzęta mają wspólnego przodka, którego nie mają rośliny (grupa Opisthokonta). Ściany komórek grzybów buduje chityna — ta sama, co pancerze owadów.',
      'Grzyby, tak jak my, nie robią fotosyntezy — trawią gotowy pokarm i oddychają tlenem.',
      'Największym znanym organizmem na Ziemi jest opieńka ciemna (Armillaria ostoyae) w Oregonie: jeden osobnik zajmuje pod ziemią ok. 9,6 km² — więcej niż 1 300 boisk piłkarskich.',
    ],
    src: 'Baldauf & Palmer, PNAS 1993; Ferguson i in., Can. J. Forest Research 2003',
  },
  {
    id: 's-lod', cat: 'swiat', topic: 'Dlaczego lód pływa',
    teaser: 'Gdyby woda zachowywała się jak prawie każda inna substancja, jeziora zamarzałyby od dna i ryby by nie przeżyły.',
    nums: [{ v: '~4 °C', l: 'woda jest wtedy najgęstsza' }, { v: '~9%', l: 'lód jest lżejszy od wody' }],
    body: [
      'Większość substancji w stanie stałym jest gęstsza niż w ciekłym. Woda jest wyjątkiem: cząsteczki w lodzie ustawiają się w ażurową sieć wiązań wodorowych, która zajmuje więcej miejsca.',
      'Dlatego lód jest o ok. 9% mniej gęsty i pływa. Najgęstsza jest woda w ok. 4 °C — opada na dno, a lód tworzy się od góry jak izolująca pokrywa.',
      'Ta sama rozszerzalność rozsadza butelki w zamrażarce i kruszy skały, gdy woda zamarza w szczelinach.',
    ],
    src: 'USGS Water Science School',
  },
  {
    id: 's-sahara', cat: 'swiat', topic: 'Sahara nawozi Amazonię',
    teaser: 'Największa pustynia świata co roku wysyła nawóz dla największego lasu deszczowego — przez ocean.',
    nums: [{ v: '~182 mln t', l: 'pyłu opuszcza Saharę rocznie' }, { v: '~28 mln t', l: 'spada na Amazonię' }, { v: '~22 tys. t', l: 'fosforu rocznie' }],
    body: [
      'Satelita NASA CALIPSO (Yu i in., 2015) mierzył chmury pyłu nad Atlantykiem przez 7 lat. Wiatr unosi z Sahary ok. 182 mln ton pyłu rocznie, a ok. 28 mln ton spada na dorzecze Amazonki.',
      'Duża część pochodzi z depresji Bodélé w Czadzie — dna wyschniętego jeziora pełnego szczątków mikroorganizmów bogatych w fosfor.',
      'Do Amazonii trafia ok. 22 tys. ton fosforu rocznie — mniej więcej tyle, ile las traci przez deszcze wypłukujące glebę.',
    ],
    src: 'Yu i in., Geophysical Research Letters 2015 (NASA)',
  },
  {
    id: 's-mrowki', cat: 'swiat', topic: 'Planeta mrówek',
    teaser: 'Mrówki na Ziemi ważą więcej niż wszystkie dzikie ptaki i ssaki razem.',
    nums: [{ v: '~20 biliardów', l: 'mrówek (2 × 10¹⁶)' }, { v: '~2,5 mln', l: 'mrówek na człowieka' }],
    body: [
      'Schultheiss i in. (PNAS 2022) zebrali 489 badań z całego świata i oszacowali liczbę mrówek na ok. 20 biliardów (20 000 000 000 000 000).',
      'Ich łączna biomasa to ok. 12 mln ton węgla — więcej niż dzikie ptaki i dzikie ssaki razem wzięte, i ok. 20% biomasy ludzi.',
      'Mrówki przenoszą nasiona, napowietrzają glebę i rozkładają materię — bez nich wiele ekosystemów by się zawaliło.',
    ],
    src: 'Schultheiss i in., PNAS 2022',
  },
  {
    id: 's-petrichor', cat: 'swiat', topic: 'Zapach deszczu',
    teaser: 'Zapach deszczu robią bakterie, a twój nos wyczuje go w stężeniu jak kropla w ogromnym jeziorze.',
    nums: [{ v: '~5 ppt', l: 'próg wyczucia geosminy (części na bilion)' }, { v: '1964', l: 'nadanie nazwy „petrichor”' }],
    body: [
      'Za zapach ziemi po deszczu odpowiada głównie geosmina — związek wytwarzany przez bakterie z rodzaju Streptomyces żyjące w glebie.',
      'Ludzki nos wyczuwa ją już w stężeniu ok. 5 części na bilion — czulej niż rekin krew w wodzie. Badacze sądzą, że to ewolucyjny sygnał „tu jest woda”.',
      'Nazwę „petrichor” wymyślili w 1964 r. australijscy chemicy Bear i Thomas. Z badań MIT wiadomo, że krople deszczu wyrzucają zapach w powietrze jak mikroskopijne bąbelki szampana.',
    ],
    src: 'Bear & Thomas, Nature 1964; Joung & Buie, Nature Communications 2015',
  },
  {
    id: 's-doba', cat: 'swiat', topic: 'Doba się wydłuża',
    teaser: 'Dawno temu doba na Ziemi trwała 18 godzin — i wciąż się wydłuża.',
    nums: [{ v: '~18 h 41 min', l: 'doba 1,4 mld lat temu' }, { v: '~2 ms', l: 'wydłużenie doby na 100 lat' }],
    body: [
      'Pływy wywołane przez Księżyc działają jak hamulec: tarcie wody o dno oceanów spowalnia obrót Ziemi.',
      'Meyers i Malinverno (PNAS 2018) na podstawie warstw skał osadowych policzyli, że 1,4 mld lat temu doba trwała ok. 18 h 41 min.',
      'Dziś doba wydłuża się średnio o ok. 1,7–2 ms na stulecie. Dlatego co jakiś czas do zegarów atomowych dodawano sekundę przestępną.',
    ],
    src: 'Meyers & Malinverno, PNAS 2018; Stephenson i in., Proc. Royal Society A 2016',
  },
  {
    id: 's-niebo', cat: 'swiat', topic: 'Błękit nieba',
    teaser: 'Niebo powinno być fioletowe — ratują je nasze oczy.',
    nums: [{ v: '~5,8×', l: 'mocniej rozpraszane jest niebieskie (450 nm) niż czerwone (700 nm)' }, { v: '1/λ⁴', l: 'prawo Rayleigha' }],
    body: [
      'Cząsteczki powietrza rozpraszają światło tym mocniej, im krótsza fala — proporcjonalnie do 1/λ⁴. Niebieskie (450 nm) rozprasza się ok. 5,8 raza mocniej niż czerwone (700 nm).',
      'Fiolet rozprasza się jeszcze mocniej, ale Słońce wysyła go mniej, część pochłania atmosfera, a nasze czopki są na niego słabo czułe. Mózg sumuje wszystko i widzi błękit.',
      'O zachodzie światło przechodzi przez dużo grubszą warstwę powietrza — niebieskie zostaje rozproszone po drodze, a do oczu dociera pomarańczowe i czerwone.',
    ],
    src: 'Rayleigh, Philosophical Magazine 1871; NASA Space Place',
  },

  // ───────── LIFEHACKI ─────────
  {
    id: 'l-2min', cat: 'lifehacki', topic: 'Reguła dwóch minut',
    teaser: 'Niezałatwione drobiazgi zjadają uwagę — a mózg uspokaja się już po zapisaniu planu.',
    nums: [{ v: '2 min', l: 'jeśli zajmie mniej — zrób od razu' }, { v: '1927', l: 'efekt Zeigarnik' }],
    body: [
      'David Allen w metodzie GTD proponuje prostą zasadę: jeśli coś zajmie mniej niż 2 minuty, zrób to od razu, zamiast zapisywać.',
      'Bluma Zeigarnik w 1927 r. zauważyła, że lepiej pamiętamy zadania przerwane niż skończone — niedokończone sprawy „wiszą” w głowie.',
      'Masicampo i Baumeister (2011) pokazali, że nie trzeba ich kończyć: wystarczy zapisać konkretny plan (co, kiedy, jak), a natrętne myśli o zadaniu słabną. Do tego służy twoja lista Zadań.',
    ],
    src: 'Allen, Getting Things Done 2001; Masicampo & Baumeister, JPSP 2011',
  },
  {
    id: 'l-pomodoro', cat: 'lifehacki', topic: 'Pomidorowy timer',
    teaser: 'Jedna z najpopularniejszych metod produktywności wzięła nazwę od kuchennego minutnika w kształcie pomidora.',
    nums: [{ v: '25 + 5', l: 'minut pracy + przerwy' }, { v: '4', l: 'cykle, potem dłuższa przerwa' }],
    body: [
      'Francesco Cirillo pod koniec lat 80. jako student mierzył czas nauki minutnikiem w kształcie pomidora (wł. „pomodoro”). Schemat: 25 minut skupienia, 5 minut przerwy, po 4 cyklach 15–30 minut przerwy.',
      'Metaanaliza Albulescu i in. (PLoS ONE 2022) pokazała, że nawet krótkie mikroprzerwy (do 10 min) wyraźnie zwiększają energię i zmniejszają zmęczenie.',
      'Najlepsza przerwa jest „analogowa”: wstań, przejdź się, popatrz w dal — nie scrolluj telefonu.',
    ],
    src: 'Cirillo, The Pomodoro Technique; Albulescu i in., PLoS ONE 2022',
  },
  {
    id: 'l-chlodzenie', cat: 'lifehacki', topic: 'Napój zimny błyskawicznie',
    teaser: 'Zapomniałeś schłodzić napój? Lód, woda i sól zrobią to szybciej niż zamrażarka.',
    nums: [{ v: 'do −10 °C', l: 'może osiągnąć woda z lodem i solą' }, { v: '~5 min', l: 'zamiast ok. 30 w zamrażarce' }],
    body: [
      'Powietrze słabo przewodzi ciepło, dlatego puszka w zamrażarce stygnie powoli. Woda odbiera ciepło ok. 20 razy szybciej.',
      'Sól obniża temperaturę topnienia lodu — mieszanina lodu, wody i soli schodzi poniżej 0 °C, nawet do ok. −10 °C i niżej.',
      'Zanurz puszkę lub butelkę w misce z lodem, wodą i 2–3 garściami soli i co chwilę nią obracaj. Po kilku minutach napój jest zimny.',
    ],
    src: 'Zasady termodynamiki (obniżenie temperatury topnienia roztworu)',
  },
  {
    id: 'l-cykle-snu', cat: 'lifehacki', topic: 'Cykle snu',
    teaser: 'Pobudka po 7,5 godzinach może dać lepsze samopoczucie niż po 8.',
    nums: [{ v: '~90 min', l: 'średni cykl snu (zakres 70–120)' }, { v: '5', l: 'cykli to 7,5 h' }, { v: '~15 min', l: 'na zaśnięcie' }],
    body: [
      'Sen składa się z cykli: lekki sen, głęboki, potem REM. Jeden trwa średnio ok. 90 minut, w nocy jest ich 4–6.',
      'Przebudzenie w głębokim śnie daje „inercję snu” — ciężką głowę i otępienie na kilkanaście minut. Pod koniec cyklu sen jest płytszy, a wstać łatwiej.',
      'Licz wstecz od pobudki w krokach po 90 min i dodaj ok. 15 min na zaśnięcie. Twój zegarek w zakładce Sen pokazuje, jak wyglądają twoje własne cykle.',
    ],
    src: 'Carskadon & Dement, Principles and Practice of Sleep Medicine; Tassi & Muzet, Sleep Medicine Reviews 2000',
  },
  {
    id: 'l-bateria', cat: 'lifehacki', topic: 'Bateria 20–80%',
    teaser: 'Ładowanie telefonu do pełna co noc może skrócić życie baterii prawie o połowę.',
    nums: [{ v: '2×', l: 'więcej cykli przy ładowaniu do ~4,1 V zamiast 4,2 V' }, { v: '85%', l: 'limit „Chroń baterię” w Samsungu' }],
    body: [
      'Ogniwa litowo-jonowe najszybciej się zużywają, gdy są długo naładowane do pełna i ciepłe. Wysokie napięcie przyspiesza reakcje uboczne na elektrodach.',
      'Według danych Battery University obniżenie napięcia ładowania z 4,20 V do ok. 4,10 V (ok. 85–90% pojemności) mniej więcej podwaja liczbę cykli.',
      'W Samsungu: Ustawienia → Bateria → Ochrona baterii. Unikaj też ładowania pod poduszką i grania podczas szybkiego ładowania — ciepło szkodzi najbardziej.',
    ],
    src: 'Battery University BU-808; Samsung One UI',
  },
  {
    id: 'l-cebula', cat: 'lifehacki', topic: 'Cebula bez łez',
    teaser: 'Za łzy przy krojeniu cebuli odpowiada enzym odkryty dopiero w 2002 r. — i da się go spowolnić.',
    nums: [{ v: '2002', l: 'odkrycie enzymu LFS' }, { v: '~15 min', l: 'w lodówce lub zamrażarce przed krojeniem' }],
    body: [
      'Gdy nóż przecina komórki cebuli, uwalniają się związki siarki. Enzym LFS (opisany w Nature w 2002 r.) zamienia je w lotny gaz drażniący oczy.',
      'Zimno spowalnia reakcje, więc schłodzona cebula „gazuje” słabiej. Ostry nóż niszczy mniej komórek niż tępy, który miażdży.',
      'Pomaga też krojenie przy okapie lub wentylatorze i zostawienie korzenia na koniec — tam jest najwięcej związków siarki.',
    ],
    src: 'Imai i in., Nature 2002',
  },
  {
    id: 'l-powtorki', cat: 'lifehacki', topic: 'Krzywa zapominania',
    teaser: 'Po godzinie zapominasz ponad połowę tego, czego się nauczyłeś — chyba że zrobisz powtórkę we właściwym momencie.',
    nums: [{ v: '1885', l: 'eksperymenty Ebbinghausa' }, { v: '~56%', l: 'uleciało po godzinie' }, { v: '~66%', l: 'po dobie' }],
    body: [
      'Hermann Ebbinghaus uczył się na pamięć ciągów bezsensownych sylab i mierzył, ile zostało. Po 20 minutach pamiętał ok. 58%, po godzinie ok. 44%, po dniu ok. 34%.',
      'Każda powtórka spłaszcza krzywą: wiedza zostaje dłużej, a odstęp do następnej powtórki można wydłużyć (np. 1 dzień → 3 → 7 → 21).',
      'Na tym opierają się aplikacje do fiszek, np. Anki. Najlepiej działa samodzielne przypominanie, a nie ponowne czytanie.',
    ],
    src: 'Ebbinghaus, Über das Gedächtnis 1885; Murre & Dros, PLoS ONE 2015 (replikacja)',
  },
  {
    id: 'l-20-20-20', cat: 'lifehacki', topic: 'Reguła 20-20-20',
    teaser: 'Przy ekranie mrugasz nawet 3 razy rzadziej — stąd suche, zmęczone oczy.',
    nums: [{ v: '20-20-20', l: 'co 20 min, 6 m dalej, przez 20 s' }, { v: '~15 → 5', l: 'mrugnięć na minutę przy ekranie' }],
    body: [
      'Normalnie mrugamy ok. 15 razy na minutę. Przy skupieniu na ekranie liczba potrafi spaść do ok. 5–7, więc film łzowy wysycha.',
      'Amerykańska Akademia Okulistyki zaleca regułę 20-20-20: co 20 minut popatrz przez 20 sekund na coś oddalonego o 20 stóp (ok. 6 m).',
      'Mięsień rzęskowy, który ustawia ostrość z bliska, wtedy się rozluźnia. Pomaga też kilka świadomych, pełnych mrugnięć.',
    ],
    src: 'American Academy of Ophthalmology; Patel i in., Optometry and Vision Science 1991',
  },
  {
    id: 'l-telefon-obok', cat: 'lifehacki', topic: 'Telefon za drzwi',
    teaser: 'Sam widok telefonu na biurku — nawet wyciszonego i ekranem w dół — obniża twoją pamięć roboczą.',
    nums: [{ v: '~800', l: 'badanych w eksperymentach' }, { v: '3', l: 'warunki: biurko, kieszeń, inny pokój' }],
    body: [
      'Ward i in. (2017) prosili studentów o rozwiązywanie testów pamięci i inteligencji. Telefon leżał na biurku ekranem w dół, w kieszeni lub w innym pokoju — zawsze wyciszony.',
      'Najlepiej wypadła grupa z telefonem w innym pokoju, a najgorzej ta z telefonem na biurku. Efekt był największy u osób najbardziej przywiązanych do smartfona.',
      'Hipoteza „drenażu mózgu”: część uwagi cały czas zajmuje pilnowanie, żeby nie sięgnąć po telefon. Do nauki i głębokiej pracy — telefon za drzwi.',
    ],
    src: 'Ward i in., Journal of the Association for Consumer Research 2017',
  },
  {
    id: 'l-mycie-rak', cat: 'lifehacki', topic: 'Śpiewaj „Sto lat”',
    teaser: 'Mydło niszczy wirusy mechanicznie — ale potrzebuje na to 20 sekund.',
    nums: [{ v: '20 s', l: 'minimalny czas mycia' }, { v: '2×', l: '„Sto lat” od początku do końca' }],
    body: [
      'Cząsteczki mydła mają jeden koniec lubiący wodę, a drugi tłuszcz. Wbijają się w tłuszczową otoczkę wielu wirusów (grypy, koronawirusów) i rozrywają ją.',
      'To trwa — dlatego CDC i WHO zalecają co najmniej 20 sekund pocierania, łącznie z kciukami, przestrzeniami między palcami i pod paznokciami.',
      'Dwa razy zaśpiewane „Sto lat” to mniej więcej 20 sekund. Potem dokładnie osusz ręce — mokre łatwiej przenoszą bakterie.',
    ],
    src: 'CDC, Handwashing; WHO Hand Hygiene Guidelines 2009',
  },

  // ───────── TECHNOLOGIE ─────────
  {
    id: 't-tranzystory', cat: 'tech', topic: 'Miliardy przełączników',
    teaser: 'Pierwszy procesor miał 2 300 tranzystorów. Dzisiejsze chipy AI mają ich 90 milionów razy więcej.',
    nums: [{ v: '2 300', l: 'tranzystorów w Intel 4004 (1971)' }, { v: '208 mld', l: 'w Nvidia Blackwell (2024)' }, { v: '1947', l: 'pierwszy tranzystor' }],
    body: [
      'Pierwszy tranzystor zbudowano w Bell Labs w grudniu 1947 r. — był wielkości dłoni. W 1971 r. Intel 4004, pierwszy mikroprocesor, miał 2 300 tranzystorów.',
      'Chip Nvidia Blackwell (2024) ma ok. 208 mld tranzystorów. Gdyby każdy był ziarnkiem piasku, wypełniłyby ok. 10 ciężarówek.',
      'Każdy tranzystor to przełącznik 0/1. W twoim telefonie jest ich kilkanaście miliardów w samym procesorze.',
    ],
    src: 'Intel; Nvidia (GTC 2024); Computer History Museum',
  },
  {
    id: 't-nanometry', cat: 'tech', topic: 'Marketingowe 3 nanometry',
    teaser: 'W chipie „3 nm” nie ma niczego, co miałoby 3 nanometry.',
    nums: [{ v: '1965', l: 'prawo Moore’a' }, { v: '~48 nm', l: 'rzeczywisty rozstaw bramek w „3 nm”' }],
    body: [
      'Gordon Moore w 1965 r. przewidział, że liczba tranzystorów w układzie będzie się podwajać co rok; w 1975 r. poprawił to na co 2 lata. Ta reguła napędzała przemysł przez pół wieku.',
      'Kiedyś nazwa procesu (np. 90 nm) mówiła o długości bramki tranzystora. Od ok. 2000 r. to już tylko nazwa handlowa: w procesie „3 nm” TSMC rozstaw bramek to ok. 48 nm, a ścieżek metalu ok. 23 nm.',
      'Liczba oznacza dziś raczej „generację”: o ile gęściej upakowano tranzystory względem poprzedniej.',
    ],
    src: 'Moore, Electronics 1965; IEEE Spectrum, „The Node is Nonsense” 2020; IRDS',
  },
  {
    id: 't-gps', cat: 'tech', topic: 'GPS i Einstein',
    teaser: 'Bez teorii względności nawigacja w telefonie myliłaby się o 10 km dziennie.',
    nums: [{ v: '+38 µs', l: 'na dobę spieszą się zegary satelitów' }, { v: '~10 km', l: 'błędu dziennie bez korekty' }],
    body: [
      'Satelity GPS lecą ok. 14 000 km/h — według szczególnej teorii względności ich zegary przez to zwalniają o ok. 7 µs na dobę.',
      'Ale są ok. 20 000 km nad Ziemią, gdzie grawitacja jest słabsza — według ogólnej teorii względności ich zegary przyspieszają o ok. 45 µs. W sumie spieszą się ok. 38 µs na dobę.',
      'Światło w 38 µs przelatuje ok. 11 km. Bez korekty błąd pozycji rósłby o ok. 10 km dziennie. Dlatego zegary satelitów celowo ustawiono przed startem na odrobinę wolniejsze tempo.',
    ],
    src: 'Ashby, Living Reviews in Relativity 2003',
  },
  {
    id: 't-sms', cat: 'tech', topic: 'Pierwszy SMS',
    teaser: 'Pierwszy SMS w historii wysłano z komputera — i nikt na niego nie odpowiedział.',
    nums: [{ v: '1992', l: 'pierwszy SMS (3 grudnia)' }, { v: '160', l: 'znaków — limit wiadomości' }],
    body: [
      '3 grudnia 1992 r. inżynier Neil Papworth wysłał z komputera na telefon Orbitel w sieci Vodafone wiadomość „Merry Christmas”. Odbiorca, Richard Jarvis, nie miał jak odpisać — telefony nie umiały jeszcze pisać SMS-ów.',
      'Limit 160 znaków zaproponował w 1985 r. Friedhelm Hillebrand. Pisał na maszynie losowe zdania i pocztówki — prawie wszystkie mieściły się w 160 znakach.',
      'W 2021 r. oryginalny SMS sprzedano jako NFT na aukcji za ok. 107 tys. euro.',
    ],
    src: 'Vodafone; Hillebrand (GSM); Aguttes, aukcja 2021',
  },
  {
    id: 't-li-ion', cat: 'tech', topic: 'Bateria w kieszeni',
    teaser: 'Najstarszy laureat Nobla w historii dostał nagrodę za baterię, która jest w twoim telefonie.',
    nums: [{ v: '1991', l: 'pierwszy akumulator Li-ion w sprzedaży (Sony)' }, { v: '−97%', l: 'spadek ceny od 1991' }, { v: '97 lat', l: 'wiek Goodenougha przy Noblu' }],
    body: [
      'Stanley Whittingham w latach 70. zbudował pierwszy akumulator litowy, John Goodenough w 1980 r. wymyślił katodę z tlenku kobaltu, a Akira Yoshino w 1985 r. stworzył bezpieczną wersję z grafitową anodą.',
      'Sony zaczęło sprzedawać akumulatory Li-ion w 1991 r. Ziegler i Trancik (2021) policzyli, że ich cena za kWh spadła od tego czasu o ok. 97%.',
      'Nobel z chemii w 2019 r. trafił do całej trójki. Goodenough miał wtedy 97 lat — to najstarszy laureat w historii.',
    ],
    src: 'Nobel Prize 2019; Ziegler & Trancik, Energy & Environmental Science 2021',
  },
  {
    id: 't-wifi', cat: 'tech', topic: 'Wi-Fi od astronomów',
    teaser: 'Kluczowy patent Wi-Fi pochodzi z prób wykrycia eksplodujących czarnych dziur.',
    nums: [{ v: '1992', l: 'patent CSIRO' }, { v: '~430 mln AUD', l: 'z licencji' }],
    body: [
      'Australijski radioastronom John O’Sullivan w latach 70. szukał słabych sygnałów od parujących czarnych dziur. Opracował metody wyciągania sygnału z echa i zakłóceń.',
      'Gdy jego zespół w CSIRO budował sieć bezprzewodową, ten sam problem — odbicia od ścian — rozwiązały te same metody matematyczne. Patent z 1992 r. stał się częścią standardu Wi-Fi.',
      'CSIRO wygrało procesy z firmami technologicznymi i zarobiło z licencji ok. 430 mln dolarów australijskich. Samych czarnych dziur nie znaleziono.',
    ],
    src: 'CSIRO, „The history of WiFi”',
  },
  {
    id: 't-kable', cat: 'tech', topic: 'Internet pod wodą',
    teaser: 'Prawie cały internet między kontynentami płynie nie przez satelity, tylko kablami po dnie oceanu.',
    nums: [{ v: '~99%', l: 'ruchu międzykontynentalnego' }, { v: '1,4 mln km', l: 'kabli podmorskich' }, { v: '~200 000 km/s', l: 'prędkość światła w szkle' }],
    body: [
      'Według TeleGeography ok. 99% danych między kontynentami płynie światłowodami po dnie mórz. Łącznie to ponad 1,4 mln km kabli — można by nimi 35 razy opasać Ziemię.',
      'Kabel na dnie oceanu jest gruby jak wąż ogrodowy. Światło w szkle leci ok. 200 000 km/s — dwie trzecie prędkości w próżni.',
      'Charles Kao dostał w 2009 r. Nobla za pokazanie, że czyste szkło może przesyłać światło na tysiące km. Kable czasem uszkadzają kotwice statków, a nawet rekiny.',
    ],
    src: 'TeleGeography, Submarine Cable Map; Nobel Prize 2009',
  },
  {
    id: 't-qr', cat: 'tech', topic: 'Kod z planszówki',
    teaser: 'Kod QR wymyślono, by śledzić części samochodowe, a inspiracją była gra Go.',
    nums: [{ v: '1994', l: 'wynalezienie (Denso Wave)' }, { v: '30%', l: 'kodu może być zniszczone' }, { v: '7 089', l: 'cyfr — maksymalna pojemność' }],
    body: [
      'Masahiro Hara z firmy Denso Wave (z grupy Toyoty) szukał kodu, który da się odczytać szybciej niż kreskowy. Patrząc na czarno-białe kamienie na planszy do Go, wpadł na dwuwymiarową siatkę.',
      'Trzy duże kwadraty w rogach mówią skanerowi, gdzie jest kod i jak jest obrócony. Dzięki korekcji błędów na najwyższym poziomie odczyt działa nawet przy ok. 30% zniszczenia — dlatego na środek można wstawić logo.',
      'Denso nie egzekwowało patentu, więc każdy mógł używać QR za darmo.',
    ],
    src: 'Denso Wave, QRcode.com; ISO/IEC 18004',
  },
  {
    id: 't-bug', cat: 'tech', topic: 'Pierwszy prawdziwy bug',
    teaser: 'Pierwszy „bug” w komputerze był prawdziwym owadem — przyklejonym taśmą do dziennika.',
    nums: [{ v: '9.09.1947', l: 'ćma w komputerze Mark II' }, { v: '15:45', l: 'godzina wpisu w dzienniku' }],
    body: [
      'Zespół Harvardu, w którym pracowała Grace Hopper, szukał usterki w komputerze Mark II. W przekaźniku nr 70 znaleźli ćmę.',
      'Przykleili ją do dziennika z dopiskiem „First actual case of bug being found” — pierwszy prawdziwy przypadek znalezienia robaka. Słowo „bug” na usterki było już w użyciu (używał go Edison), stąd żart.',
      'Strona dziennika z ćmą jest dziś w Smithsonian National Museum of American History w Waszyngtonie.',
    ],
    src: 'Smithsonian National Museum of American History',
  },
  {
    id: 't-centra-danych', cat: 'tech', topic: 'Głodne centra danych',
    teaser: 'Centra danych zużywają już tyle prądu co cała Francja — a do 2030 r. ma być ponad dwa razy więcej.',
    nums: [{ v: '~415 TWh', l: 'zużycie w 2024 r.' }, { v: '~1,5%', l: 'światowego prądu' }, { v: '~945 TWh', l: 'prognoza na 2030 r.' }],
    body: [
      'Według Międzynarodowej Agencji Energetycznej (raport „Energy and AI”, 2025) centra danych zużyły w 2024 r. ok. 415 TWh — ok. 1,5% światowego prądu.',
      'Główny powód wzrostu to sztuczna inteligencja: serwery z akceleratorami zużywają dużo więcej energii i potrzebują intensywnego chłodzenia. Prognoza IEA na 2030 r.: ok. 945 TWh.',
      'Dla porównania: Polska zużywa rocznie ok. 170 TWh prądu.',
    ],
    src: 'IEA, Energy and AI 2025; PSE',
  },
];
