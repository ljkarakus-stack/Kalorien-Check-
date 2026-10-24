"use strict";

// Micronutrients for the built-in foods, as approximate reference values per 100 g (100 ml),
// or per portion for portion foods. Order: see NUTRIENTS.
const NUTRIENTS = [
  { key: "fib", name: "Ballaststoffe", unit: "g", d: 1 },
  { key: "fe", name: "Eisen", unit: "mg", d: 1 },
  { key: "ca", name: "Calcium", unit: "mg", d: 0 },
  { key: "mg", name: "Magnesium", unit: "mg", d: 0 },
  { key: "zn", name: "Zink", unit: "mg", d: 1 },
  { key: "k", name: "Kalium", unit: "mg", d: 0 },
  { key: "vc", name: "Vitamin C", unit: "mg", d: 0 },
  { key: "vd", name: "Vitamin D", unit: "µg", d: 1 },
  { key: "b12", name: "Vitamin B12", unit: "µg", d: 1 },
  { key: "fol", name: "Folat", unit: "µg", d: 0 },
];

// Daily reference values for adults (25 to under 51), based on the DGE reference values.
// "d" (divers / keine Angabe) uses the midpoint.
const NUTRIENT_REFS = {
  w: { fib: 30, fe: 15, ca: 1000, mg: 300, zn: 8, k: 4000, vc: 95, vd: 20, b12: 4, fol: 300 },
  m: { fib: 30, fe: 11, ca: 1000, mg: 350, zn: 14, k: 4000, vc: 110, vd: 20, b12: 4, fol: 300 },
  d: { fib: 30, fe: 13, ca: 1000, mg: 325, zn: 11, k: 4000, vc: 100, vd: 20, b12: 4, fol: 300 },
};

// Good everyday sources, shown when a nutrient is often low
const NUTRIENT_SOURCES = {
  fib: "Haferflocken, Vollkornbrot, Linsen, Himbeeren, Chiasamen",
  fe: "Linsen, Haferflocken, Kürbiskerne, Rindfleisch, Spinat – am besten zusammen mit Vitamin C, z. B. Paprika",
  ca: "Skyr, Joghurt, Emmentaler, Mozzarella, Rucola, Mandeln",
  mg: "Kürbiskerne, Haferflocken, Vollkornbrot, Cashews, Banane",
  zn: "Rindfleisch, Haferflocken, Kürbiskerne, Emmentaler, Linsen",
  k: "Kartoffeln, Banane, Avocado, Spinat, Linsen",
  vc: "Paprika, Brokkoli, Kiwi, Orange, Erdbeeren",
  vd: "Lachs, Forelle, Matjes, Eier. Vitamin D bildet der Körper vor allem über Sonnenlicht; über Essen allein ist der Wert kaum erreichbar.",
  b12: "Rindfleisch, Fisch, Eier, Milchprodukte. Bei veganer Ernährung angereicherte Produkte.",
  fol: "Spinat, Edamame, Linsen, Brokkoli, Kichererbsen",
};

//          fib   fe    ca    mg   zn    k     vc   vd    b12   fol
const MICRO_TABLE = `
harzer      0     0.3   125   15   2     100   0    0.1   1.5   30
kabeljau    0     0.4   16    30   0.5   350   1    1.3   0.9   12
eiklar      0     0.1   7     11   0.03  163   0    0     0.1   4
putenbrust  0     0.7   10    28   1.5   330   0    0.1   0.4   8
garnelen    0     0.3   64    35   1.3   180   0    0.1   1.1   19
thunfisch   0     1     10    27   0.7   240   0    1.7   2.5   4
haehnchen   0     0.4   5     28   0.8   330   0    0.1   0.3   5
rinderhuefte 0    2.2   5     22   4.5   360   0    0.1   2     6
magerquark  0     0.1   92    11   0.5   150   1    0     0.8   25
skyr        0     0.1   110   11   0.5   150   0    0     0.6   10
tk-classic  3     0.8   12    25   0.4   500   7    0     0     20
tk-steakhouse 3   0.8   12    25   0.4   520   7    0     0     20
tk-wedges   3     0.9   12    27   0.4   550   8    0     0     20
tk-roesti   2.8   0.7   12    22   0.4   450   6    0     0     15
tk-taschen  2.5   0.6   40    20   0.5   350   4    0     0.1   15
ff-pizza    8     6     700   90   6     1000  6    0.5   2     120
ff-duerum   6     5     250   80   6     900   15   0.2   2.5   80
ff-doener   5     4.5   200   70   5     800   12   0.2   2.2   70
ff-currywurst 2   1.5   40    30   2.5   500   6    0.4   0.8   15
ff-burger   2.5   3.5   150   40   4.5   450   2    0.2   2     50
ff-pommes   5     1.3   20    45   0.6   900   10   0     0     40
haferflocken 10   4.2   54    138  3.6   360   0    0     0     35
beeren      4     0.8   25    18   0.3   170   25   0     0     20
reis        1.4   0.8   6     25   1.1   115   0    0     0     8
nudeln      3     1.5   20    50   1.3   200   0    0     0     18
kartoffeln  1.7   0.4   6     21   0.3   420   17   0     0     15
gemuese     2.6   0.6   30    18   0.3   250   100  0     0     50
brokkoli    3     0.8   58    20   0.4   330   94   0     0     65
gurke       0.5   0.2   15    8    0.2   165   8    0     0     15
tomate      1     0.3   9     11   0.2   240   19   0     0     22
apfel       2     0.1   5     5    0.04  120   12   0     0     7
banane      2     0.3   7     30   0.2   370   11   0     0     20
mandeln     11    3.7   250   270  3.1   730   0    0     0     45
erdnussmus  6     1.9   45    170  2.9   650   0    0     0     90
olivenoel   0     0.4   1     0    0     1     0    0     0     0
ei          0     1.8   50    12   1.3   140   0    2     1.5   50
milch       0     0.05  120   12   0.4   150   1    0.03  0.4   5
huettenkaese 0    0.1   80    8    0.4   90    0    0     0.5   15
gouda       0     0.2   820   30   3.8   90    0    0.3   1.5   20
lachs       0     0.4   10    28   0.4   370   0    10    3     26
tofu        1     2     200   60   1.5   150   0    0     0     30
vollkornbrot 7    2     40    60   2     250   0    0     0     30
fladenbrot  2.5   1.5   30    25   0.8   130   0    0     0     25
birne       3     0.2   10    7    0.1   120   4    0     0     7
orange      2     0.2   40    12   0.1   180   50   0     0     30
mandarine   1.8   0.2   35    11   0.1   160   30   0     0     15
kiwi        3     0.3   35    17   0.1   310   60   0     0     25
trauben     1     0.4   12    8    0.1   190   4    0     0     4
erdbeeren   2     0.4   20    13   0.1   150   60   0     0     40
heidelbeeren 2.4  0.3   10    6    0.2   80    10   0     0     6
himbeeren   6.5   0.7   25    22   0.4   150   26   0     0     20
mango       1.6   0.2   11    10   0.1   170   36   0     0     40
ananas      1.4   0.3   13    12   0.1   110   20   0     0     10
melone      0.4   0.2   7     10   0.1   110   8    0     0     3
pfirsich    1.5   0.3   6     9    0.2   190   8    0     0     4
pflaumen    1.6   0.2   6     7    0.1   160   5    0     0     5
kirschen    2     0.4   13    11   0.1   220   7    0     0     4
grapefruit  1.6   0.1   20    9    0.1   140   40   0     0     15
avocado     6.5   0.5   12    29   0.6   480   10   0     0     80
datteln     8     1     64    43   0.3   650   0    0     0     15
rosinen     4     1.9   50    32   0.2   750   1    0     0     5
paprika     1.6   0.4   9     12   0.2   210   140  0     0     50
karotte     2.8   0.3   33    12   0.2   320   6    0     0     20
zucchini    1     0.4   16    18   0.3   260   15   0     0     25
blumenkohl  2     0.4   22    15   0.3   300   48   0     0     55
spinat      2.2   2.7   100   79   0.5   560   28   0     0     145
champignons 2     0.4   3     9    0.5   320   2    0.2   0     25
zwiebel     1.7   0.2   20    10   0.2   160   7    0     0     15
knoblauch   2     1.7   180   25   1.2   400   31   0     0     3
eisberg     1.2   0.4   18    7    0.2   140   3    0     0     30
feldsalat   1.5   2     35    13   0.5   420   35   0     0     70
rucola      1.6   1.5   160   47   0.5   370   15   0     0     97
weisskohl   2.5   0.5   45    12   0.2   230   45   0     0     40
rotkohl     2.5   0.5   35    15   0.2   250   55   0     0     25
mais        3     0.5   4     20   0.4   180   4    0     0     30
erbsen      5     1.5   24    25   0.8   200   20   0     0     60
bohnen-gruen 2.5  0.8   50    25   0.3   240   15   0     0     40
aubergine   2.8   0.4   10    12   0.2   230   4    0     0     20
kuerbis     2.5   0.8   20    15   0.3   380   15   0     0     25
spargel     1.5   0.7   25    15   0.4   200   15   0     0     70
radieschen  1.6   0.4   30    10   0.3   250   25   0     0     25
lauch       2     1     60    12   0.2   220   18   0     0     60
suesskartoffel 3  0.6   30    25   0.3   340   2.5  0     0     11
edamame     5     2.3   63    64   1.4   440   6    0     0     300
kidney      6     1.6   35    40   0.8   300   1    0     0     40
kichererbsen 5    1.3   40    25   0.9   170   0    0     0     50
linsen      11    7     40    80   3.7   840   1    0     0     200
linsen-rot  11    7     48    90   3.6   580   2    0     0     200
toast       3     1     40    25   0.7   130   0    0     0     25
vk-toast    6     1.8   40    60   1.6   250   0    0     0     30
broetchen   3     1     25    25   0.7   120   0    0     0     25
vk-broetchen 6    2     30    60   1.6   230   0    0     0     30
mischbrot   5     1.8   25    35   1.1   200   0    0     0     20
roggenbrot  6.5   2     25    45   1.4   250   0    0     0     20
knaecke     14    3     30    80   2.5   400   0    0     0     40
proteinbrot 12    3     100   100  2.5   500   0    0     0     40
brezel      2.5   1     20    22   0.7   120   0    0     0     20
croissant   2     1.5   30    20   0.7   120   0    0.5   0.2   40
baguette    3     1.3   30    25   0.8   120   0    0     0     30
reiswaffel  4     2     10    130  2.5   290   0    0     0     20
wrap        3     2     80    20   0.6   130   0    0     0     40
vk-nudeln   8     3.5   40    140  3     400   0    0     0     40
nudeln-gekocht 1.5 0.6  7     18   0.5   60    0    0     0     7
reis-gekocht 0.4  0.2   2     12   0.5   35    0    0     0     3
reisnudeln  1.6   0.7   18    12   0.6   30    0    0     0     3
quinoa      7     4.6   47    197  3.1   560   0    0     0     180
couscous    5     1.1   24    44   0.8   170   0    0     0     20
bulgur      12    2.5   35    160  1.9   410   0    0     0     27
kartoffeln-gekocht 1.8 0.4 6  20   0.3   380   12   0     0     10
gnocchi     1.5   0.4   10    15   0.3   200   2    0     0     8
muesli      9     3.5   60    110  2.5   450   1    0     0     40
granola     6     2.5   50    80   1.5   300   0    0     0     25
cornflakes  3     1.5   5     15   0.3   100   0    0     0     10
mehl        4     1.5   15    22   0.7   140   0    0     0     10
quark-20    0     0.1   85    10   0.5   140   1    0.1   0.8   20
joghurt-35  0     0.05  120   12   0.5   160   1    0.06  0.4   10
joghurt-15  0     0.05  125   12   0.5   165   1    0.03  0.4   10
griech-joghurt 0  0.1   100   11   0.5   140   0    0.1   0.5   8
proteinpudding 0.5 0.4  150   20   0.5   200   0    0     0.4   8
frischkaese 0     0.1   80    8    0.5   120   0    0.2   0.3   10
frischkaese-light 0 0.1 120   10   0.6   150   0    0.1   0.4   12
mozzarella  0     0.2   500   20   2.8   80    0    0.2   1.5   10
mozzarella-light 0 0.2  550   22   3     90    0    0.1   1.6   10
feta        0     0.6   490   20   2.9   60    0    0.4   1.7   30
emmentaler  0     0.3   1000  35   4.5   100   0    1.1   2     10
parmesan    0     0.8   1180  44   4     90    0    0.5   1.5   7
butter      0     0.02  15    2    0.1   20    0    1.2   0.2   3
sahne       0     0.1   80    9    0.3   110   1    0.6   0.3   5
saure-sahne 0     0.1   110   11   0.4   140   1    0.2   0.3   10
milch-35    0     0.05  120   12   0.4   150   1    0.09  0.4   5
kefir       0     0.05  120   12   0.4   150   1    0.06  0.3   10
buttermilch 0     0.1   110   15   0.4   150   1    0     0.3   5
hafermilch  0.8   0.1   10    8    0.1   40    0    0     0     5
mandelmilch 0.3   0.1   10    5    0.05  30    0    0     0     1
sojamilch   0.6   0.4   15    18   0.2   120   0    0     0     10
kakao       0.5   0.4   110   20   0.5   170   0    0     0.3   5
haehnchenschenkel 0 0.8 10    20   1.8   230   0    0.2   0.4   8
rinderhack-mager 0 2.2  6     22   5     340   0    0.1   2     7
rinderhack  0     2     8     20   4.5   300   0    0.1   2     7
hack-gemischt 0   1.4   8     20   3.5   300   0    0.3   1.2   5
schweinefilet 0   1     4     25   2     400   0    0.5   0.6   3
schweineschnitzel 0 0.8 4     25   1.8   390   0    0.5   0.5   3
frikadelle  1     1.5   30    20   2.5   280   1    0.2   1     10
kochschinken 0    1     8     20   2     300   0    0.5   0.6   3
putenaufschnitt 0 1     10    22   1.5   300   0    0.1   0.4   5
pastrami    0     2.2   8     20   4.5   300   0    0     1.8   6
roastbeef   0     2     8     20   4.5   330   0    0     1.8   6
bresaola    0     2.8   10    25   5     450   0    0     2.5   5
haehnchenaufschnitt 0 0.6 8   22   0.8   280   0    0.1   0.3   5
lachsschinken 0   1     8     22   2     350   0    0.5   0.6   3
salami      0     1.5   10    15   3     300   0    1     1.3   3
bratwurst   0     1     10    15   2     230   0    0.5   0.8   3
wiener      0     1     10    12   1.8   200   0    0.4   0.8   3
leberwurst  0     4     20    12   3     150   0    1     13    20
speck       0     0.8   7     15   2     280   0    0.6   0.7   2
seelachs    0     0.5   15    40   0.5   380   0    1     3.5   5
forelle     0     0.4   15    25   0.5   450   0    10    4.5   15
raeucherlachs 0   0.6   15    25   0.5   350   0    15    3     8
thunfisch-oel 0   1     7     25   0.6   240   0    1.7   2.2   4
fischstaebchen 1  0.6   15    25   0.4   250   0    0.5   0.6   10
matjes      0     1     30    20   0.5   200   0    25    9     5
makrele     0     1.2   15    30   0.6   350   0    8     10    5
raeuchertofu 1.5  2.5   150   60   1.5   200   0    0     0     25
tempeh      6     2.7   110   80   1.1   410   0    0     0.1   24
seitan      0.6   2     40    30   1     100   0    0     0     10
sojaschnetzel 15  9     250   250  4.5   2000  0    0     0     300
falafel     5     3.4   55    80   1.5   580   2    0     0     90
hummus      6     2.4   40    70   1.8   230   0    0     0     80
walnuesse   6     2.9   95    160  3     450   1    0     0     77
cashews     3.3   6.7   37    290  5.8   660   0    0     0     25
haselnuesse 10    3.8   115   160  2.5   680   6    0     0     113
erdnuesse   8     2     55    175  3.3   650   0    0     0     140
pistazien   10    3.9   107   121  2.2   1025  5    0     0     50
chia        34    7.7   630   335  4.6   410   1.6  0     0     49
leinsamen   27    5.7   255   390  4.3   810   0.6  0     0     87
sonnenblumenkerne 8.6 5.2 78  325  5     645   1.4  0     0     227
kuerbiskerne 6    8.8   46    590  7.8   810   1.9  0     0     58
mandelmus   10    3.5   270   280  3.3   750   0    0     0     50
rapsoel     0     0     0     0    0     0     0    0     0     0
margarine   0     0     10    1    0     20    0    2.5   0     0
honig       0.2   0.4   6     2    0.2   50    0.5  0     0     2
marmelade   1     0.3   15    5    0.1   80    5    0     0     2
nussnougat  3.4   2.5   110   60   1     400   0    0     0     10
ketchup     0.5   0.4   15    13   0.2   280   5    0     0     10
mayo        0     0.3   10    1    0.1   20    0    0.3   0.2   5
senf        4     1.7   60    70   0.8   150   1    0     0     10
pesto       2     1     300   40   1.2   150   1    0     0.3   30
passata     1.2   0.6   15    15   0.2   320   8    0     0     15
sojasosse   0.8   1.9   30    40   0.4   200   0    0     0     15
zucker      0     0     0     0    0     2     0    0     0     0
ahornsirup  0     0.1   100   20   1.5   210   0    0     0     0
vollmilchschoko 2 1.5   220   60   1.5   420   0    0.1   0.4   10
zartbitter  11    8     70    230  3.3   720   0    0     0     10
gummibaerchen 0   0.4   5     2    0.1   10    0    0     0     0
chips       4     1.5   20    60   0.8   1200  10   0     0     30
salzstangen 3     2     25    30   0.8   140   0    0     0     25
butterkeks  2     1.2   30    20   0.6   120   0    0.2   0     15
proteinriegel 5   2     150   60   1.5   300   0    0     0.5   20
muesliriegel 5    1.5   40    50   1     250   0    0     0     15
eis         0.3   0.1   120   12   0.5   170   0    0.1   0.4   5
kuchen      1     1     30    12   0.5   100   0    0.8   0.3   15
cola        0     0     2     0    0     2     0    0     0     0
cola-zero   0     0     2     0    0     5     0    0     0     0
osaft       0.2   0.2   10    10   0.05  180   35   0     0     20
apfelschorle 0    0.1   5     2    0     50    1    0     0     0
energy      0     0     10    1    0     5     0    0     1     0
bier        0     0     5     8    0     40    0    0     0.02  8
bier-af     0     0     5     8    0     40    0    0     0     8
weisswein   0     0.3   10    10   0.1   70    0    0     0     1
rotwein     0     0.5   8     12   0.1   120   0    0     0     1
kaffee      0     0     2     7    0     90    0    0     0     0
milchkaffee 0     0.05  60    10   0.2   120   0    0.03  0.2   3
proteinshake 0    0.5   150   30   1     150   0    0     0.6   10
gericht-bolo 8    4.5   80    90   5     900   15   0.2   2     40
gericht-margherita 8 4  800   70   5     700   8    0.3   1.8   60
gericht-caesar 4  2     250   60   2.5   700   15   0.5   0.8   100
gericht-sushi 2   1     30    40   1.5   300   1    1     0.8   30
gericht-falafel-wrap 12 6 200 120  3     900   15   0     0     180
gericht-lasagne 4 3     350   60   4.5   700   10   0.3   1.5   30
`;

const MICROS = Object.fromEntries(MICRO_TABLE.trim().split("\n").map(line => {
  const [id, ...vals] = line.trim().split(/\s+/);
  return [id, Object.fromEntries(NUTRIENTS.map((n, i) => [n.key, +vals[i]]))];
}));
FOODS.forEach(f => { if (MICROS[f.id]) f.m = MICROS[f.id]; });

function nutrientRefs() {
  return NUTRIENT_REFS[state.profile?.sex] || NUTRIENT_REFS.d;
}

// Open Food Facts reports most minerals and vitamins in grams per 100 g
const OFF_MICROS = {
  fib: ["fiber_100g", 1], fe: ["iron_100g", 1000], ca: ["calcium_100g", 1000], mg: ["magnesium_100g", 1000],
  zn: ["zinc_100g", 1000], k: ["potassium_100g", 1000], vc: ["vitamin-c_100g", 1000], vd: ["vitamin-d_100g", 1e6],
  b12: ["vitamin-b12_100g", 1e6], fol: ["vitamin-b9_100g", 1e6],
};
function offMicros(n) {
  const m = {};
  for (const [key, [field, factor]] of Object.entries(OFF_MICROS)) {
    const v = n[field] ?? (key === "fol" ? n["folates_100g"] : undefined);
    if (v != null && v !== "") m[key] = +v * factor;
  }
  return Object.keys(m).length ? m : null;
}
