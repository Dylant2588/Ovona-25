# Nutrient sources and boundaries

Food data: Public Health England, CoFID 2021, downloaded 4 November 2026 from the workbook linked by https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid . Crown copyright, Open Government Licence v3.0. Workbook SHA256: 436e9445ef2adb2a75f3d7edd51302de3adad25385f9795fc94ba58bd030e97d.

Selected edible-food rows, per 100g, with no missing/trace markers in the selected cells:

| Food code | Description | Calcium mg | Iron mg | Vitamin C mg |
|---|---|---:|---:|---:|
| 14-318 | Bananas, flesh only | 6 | 0.27 | 9 |
| 13-523 | Cucumber, raw, flesh and skin | 21 | 0.30 | 2 |
| 13-519 | Tomatoes, cherry, raw | 10 | 0.34 | 15 |

Extraction: workbook worksheets 4 (Proximates: J/K/L/M protein/fat/carbohydrate/kcal), 5 (Inorganics: J calcium, M iron), 6 (Vitamins: X vitamin C). Join by food code, never row position. Data references for these rows: DH, Nutrient analysis of fruit and vegetables, 2013. Other markers such as N or Tr are unknown, never numeric zero.

Mappings are restricted to exact reviewed recipe version, ingredient index, name and canonical ID where the method explicitly serves these ingredients raw: banana in vanilla-berry-pea-shake v2; cucumber and cherry tomatoes in chicken-crunch-snack-box v2; cucumber in turkey-cucumber-rolls v2. No mapping for cooked apple oats, pancakes or optionally heated banana pots. No fuzzy global matching, cooking retention assumptions, branded equivalence or conversion guesses.

These are generic display estimates, not new recipe approvals or corrections to immutable macro values. Missing ingredient coverage keeps the full-day nutrient total unknown. Portion and unit conversion reuse the existing calculation module.

Reference values: Annex XIII Part A of Regulation 1169/2011, official published text https://www.legislation.gov.uk/eur/2011/1169/pdfs/eur_20111169_2014-02-19_en.pdf page 57: calcium 800mg, iron 14mg and vitamin C 80mg. These are general adult food-labelling nutrient reference values, not personalised requirements or clinical targets. No inference from health conditions or unknown demographics is made. A single day cannot establish long-term adequacy.
