// Built-in food list. Values per 100 g unless `portion` is set (then per portion).
// Sources: the @jamileo__ reels (Protein-Spickzettel, TK-Kartoffeln from package labels,
// Fast-Food-Ranking) plus common reference values. All values are approximate.
const FOODS = [
  // Protein-Spickzettel
  { id: "harzer", name: "Harzer Käse", cat: "Protein-Spickzettel", kcal: 112, p: 27, kh: 0, f: 0.5 },
  { id: "kabeljau", name: "Kabeljau, roh", cat: "Protein-Spickzettel", kcal: 77, p: 18, kh: 0, f: 0.6 },
  { id: "eiklar", name: "Eiklar", cat: "Protein-Spickzettel", kcal: 48, p: 11, kh: 0.7, f: 0.2 },
  { id: "putenbrust", name: "Putenbrust, roh", cat: "Protein-Spickzettel", kcal: 105, p: 24, kh: 0, f: 1 },
  { id: "garnelen", name: "Garnelen, roh", cat: "Protein-Spickzettel", kcal: 80, p: 18, kh: 0.5, f: 0.8 },
  { id: "thunfisch", name: "Thunfisch im eigenen Saft", cat: "Protein-Spickzettel", kcal: 116, p: 26, kh: 0, f: 1 },
  { id: "haehnchen", name: "Hähnchenbrust, roh", cat: "Protein-Spickzettel", kcal: 110, p: 23, kh: 0, f: 1.5 },
  { id: "rinderhuefte", name: "Rinderhüfte, roh", cat: "Protein-Spickzettel", kcal: 112, p: 22, kh: 0, f: 2.5 },
  { id: "magerquark", name: "Magerquark", cat: "Protein-Spickzettel", kcal: 67, p: 12, kh: 4, f: 0.2 },
  { id: "skyr", name: "Skyr natur", cat: "Protein-Spickzettel", kcal: 63, p: 11, kh: 4, f: 0.2 },

  // TK-Kartoffeln (values from the packaging comparison)
  { id: "tk-classic", name: "Pommes Frites Classic (TK)", cat: "TK-Kartoffeln", kcal: 273, p: 3.3, kh: 39.9, f: 11.9 },
  { id: "tk-steakhouse", name: "Steakhouse-Pommes (TK)", cat: "TK-Kartoffeln", kcal: 244, p: 3.6, kh: 36.7, f: 9.1 },
  { id: "tk-wedges", name: "Kartoffel-Wedges (TK)", cat: "TK-Kartoffeln", kcal: 236, p: 3.2, kh: 35.6, f: 8.6 },
  { id: "tk-roesti", name: "Rösti-Ecken (TK)", cat: "TK-Kartoffeln", kcal: 246, p: 2.5, kh: 33.5, f: 10.1 },
  { id: "tk-taschen", name: "Kartoffeltaschen mit Frischkäse (TK)", cat: "TK-Kartoffeln", kcal: 261, p: 5.7, kh: 29.4, f: 13.1 },

  // Fast Food, per usual portion
  { id: "ff-pizza", name: "Pizza Salami, ganz (ca. 30 cm)", cat: "Fast Food", portion: "Pizza", kcal: 1100, p: 45, kh: 120, f: 48 },
  { id: "ff-duerum", name: "Dürüm", cat: "Fast Food", portion: "Stück", kcal: 900, p: 45, kh: 85, f: 40 },
  { id: "ff-doener", name: "Döner im Fladenbrot", cat: "Fast Food", portion: "Stück", kcal: 750, p: 38, kh: 70, f: 34 },
  { id: "ff-currywurst", name: "Currywurst mit Soße", cat: "Fast Food", portion: "Portion", kcal: 550, p: 18, kh: 20, f: 44 },
  { id: "ff-burger", name: "Fast-Food-Burger mit Käse", cat: "Fast Food", portion: "Stück", kcal: 500, p: 25, kh: 45, f: 24 },
  { id: "ff-pommes", name: "Pommes, mittlere Portion", cat: "Fast Food", portion: "Portion", kcal: 450, p: 5, kh: 55, f: 22 },
  { id: "protein-doener", name: "Protein-Döner (selbstgemacht)", cat: "Fast Food", portion: "Stück", kcal: 520, p: 54, kh: 56, f: 6.5 },

  // Basics
  { id: "haferflocken", name: "Haferflocken", cat: "Basics", kcal: 370, p: 13.5, kh: 59, f: 7 },
  { id: "beeren", name: "Beeren (TK)", cat: "Basics", kcal: 40, p: 1, kh: 7, f: 0.4 },
  { id: "reis", name: "Reis, roh", cat: "Basics", kcal: 350, p: 7, kh: 78, f: 0.6 },
  { id: "nudeln", name: "Nudeln, roh", cat: "Basics", kcal: 355, p: 12, kh: 70, f: 1.5 },
  { id: "kartoffeln", name: "Kartoffeln, roh", cat: "Basics", kcal: 75, p: 2, kh: 15, f: 0.1 },
  { id: "gemuese", name: "Gemüse-Mix (Brokkoli, Paprika)", cat: "Basics", kcal: 32, p: 2, kh: 4, f: 0.4 },
  { id: "brokkoli", name: "Brokkoli", cat: "Basics", kcal: 34, p: 3, kh: 3, f: 0.4 },
  { id: "gurke", name: "Gurke", cat: "Basics", kcal: 15, p: 0.6, kh: 2, f: 0.2 },
  { id: "tomate", name: "Tomate", cat: "Basics", kcal: 18, p: 0.9, kh: 3, f: 0.2 },
  { id: "apfel", name: "Apfel", cat: "Basics", kcal: 52, p: 0.3, kh: 12, f: 0.2 },
  { id: "banane", name: "Banane", cat: "Basics", kcal: 89, p: 1.1, kh: 20, f: 0.3 },
  { id: "mandeln", name: "Mandeln", cat: "Basics", kcal: 600, p: 21, kh: 6, f: 52 },
  { id: "erdnussmus", name: "Erdnussmus", cat: "Basics", kcal: 610, p: 25, kh: 13, f: 50 },
  { id: "olivenoel", name: "Olivenöl", cat: "Basics", kcal: 884, p: 0, kh: 0, f: 100 },
  { id: "ei", name: "Hühnerei", cat: "Basics", kcal: 155, p: 13, kh: 1, f: 11 },
  { id: "milch", name: "Milch 1,5 %", cat: "Basics", kcal: 47, p: 3.4, kh: 4.9, f: 1.5 },
  { id: "huettenkaese", name: "Körniger Frischkäse", cat: "Basics", kcal: 98, p: 12, kh: 3, f: 4.3 },
  { id: "gouda", name: "Gouda", cat: "Basics", kcal: 360, p: 25, kh: 0, f: 29 },
  { id: "lachs", name: "Lachs, roh", cat: "Basics", kcal: 200, p: 20, kh: 0, f: 13 },
  { id: "tofu", name: "Tofu natur", cat: "Basics", kcal: 120, p: 12, kh: 2, f: 7 },
  { id: "vollkornbrot", name: "Vollkornbrot", cat: "Basics", kcal: 220, p: 7, kh: 39, f: 1.5 },
  { id: "fladenbrot", name: "Fladenbrot", cat: "Basics", kcal: 260, p: 9, kh: 52, f: 1.5 },
];

// Ready-made day plans: [foodId, grams or portions, slot]
const PLANS = [
  {
    id: "1600-100",
    name: "1600 kcal · 100 g Protein",
    note: "Mein Tag zum Nachmachen aus dem Reel „Was esse ich heute?“",
    items: [
      ["skyr", 250, "fruehstueck"], ["beeren", 100, "fruehstueck"], ["haferflocken", 40, "fruehstueck"],
      ["haehnchen", 125, "mittag"], ["reis", 70, "mittag"], ["gemuese", 200, "mittag"], ["olivenoel", 10, "mittag"],
      ["apfel", 150, "snack"], ["mandeln", 30, "snack"],
      ["kartoffeln", 400, "abend"], ["magerquark", 150, "abend"], ["gurke", 150, "abend"], ["olivenoel", 5, "abend"],
    ],
  },
];
