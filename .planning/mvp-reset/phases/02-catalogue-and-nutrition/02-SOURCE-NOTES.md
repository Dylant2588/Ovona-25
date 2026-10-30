# CoFID 2021 narrow source evidence

Extracted 2026-10-29 directly from the [official publication](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid) workbook link, using Python standard-library urllib, zipfile and ElementTree. No package was installed. The workbook is cached in the executing user's temporary directory rather than committed to application assets.

- Workbook: https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx
- SHA256: `436e9445ef2adb2a75f3d7edd51302de3adad25385f9795fc94ba58bd030e97d`
- Dataset: CoFID 2021; publisher Public Health England.
- Sheet: `1.3 Proximates`, resolved through workbook relationships, not a guessed ordinal.
- Columns: J Protein (g), K Fat (g), L Carbohydrate (g), M Energy (kcal).
- Basis: 100g of the food as described; these selected foods are not alcoholic beverages. The workbook Notes sheet and official [user guide](https://assets.publishing.service.gov.uk/media/60538e66d3bf7f03249bac58/McCance_and_Widdowsons_Composition_of_Foods_integrated_dataset_2021.pdf) specify basis and qualifiers.

`source-data/cofid2021-selected-foods.json` retains exact names, descriptions, main data references, source cell coordinates/literals and typed values. `source-data/extract-cofid.py` reproduces the extraction and asserts the pinned workbook hash. Run with `python .planning/mvp-reset/phases/02-catalogue-and-nutrition/source-data/extract-cofid.py`; network and temporary-file access may require the normal sandbox escalation.

| Food code | Exact source name | kcal / protein / carbohydrate / fat per 100g |
|---|---|---|
| 18-290 | Chicken, light meat, raw | 106 / 24 / 0 / 1.1 |
| 13-521 | Spinach, baby, raw | 16 / 2.6 / 0.2 / 0.6 |
| 13-572 | Spinach, mature, raw | 25 / 2.8 / 1.6 / 0.8 |
| 11-868 | Rice, brown, wholegrain, raw | 333 / 7.7 / 77 / 1.5 |
| 11-788 | Porridge oats, unfortified | 381 / 10.9 / 70.7 / 8.1 |
| 17-038 | Oil, olive | 899 / **Tr** / 0 / 99.9 |
| 13-670 | Beans, chick peas, canned, re-heated, drained | 129 / 8.4 / 18.3 / 3 |

No values are inferred from recipe targets. `Tr` remains `kind: trace, value: null`; it is not numeric zero. Blank or `N` remains unknown if encountered; none of the other selected four-macro cells is missing. Only literal numeric values parse to finite nonnegative numbers. The application must explicitly define and disclose any future trace policy; until then olive oil cannot pass an engine requiring four numeric source values.

The raw chicken food is called **light meat**, not breast, and raw spinach has distinct baby/mature rows. These facts are deliberate mapping warnings. Do not automatically map generic recipe names to these rows. `sourceState` is an explicit descriptive proposal derived from the food name; it is not a human-approved recipe-to-food mapping. Chickpeas require the canned/reheated/drained state, not arbitrary dry or undrained quantities. Oats code 11-788 is the unfortified as-sold product; a separate cooked-with-milk row 11-789 exists and was deliberately excluded. Match oats to the unfortified product and its measured uncooked/as-sold quantity, not cooked porridge weight. No density, tablespoon weight, unit edible mass, cooking yield or nutrient-retention factor was invented.

This extraction establishes source values, not recipe review. It contains no allergy/cross-contact evidence, recipe rights confirmation, cook-through attestation, approved recipe, automatic import, database write or live rollout.

The user guide permits reuse under Open Government Licence v3.0 and notes identified third-party material may require permission. Retain attribution: “Contains public sector information licensed under the Open Government Licence v3.0. CoFID 2021, Public Health England.” Source main-data references are retained for review; this note does not claim blanket rights to recipes or third-party material.

Verification: extraction completed with seven unique food codes and one trace field; a second source-cell inspection confirmed columns and exact values. No missing source value was converted to zero. The initial exploratory sheet export was removed, leaving only the narrow JSON and extraction script in source-data.

## Demonstrator guidance

An original **pending** brown wholegrain rice / baby spinach / canned re-heated drained chickpea bowl can use explicit gram quantities and exact source names above. Existing taxonomy aliases cover Brown rice (`rice`), Spinach (`spinach`) and Chickpeas (`chickpea`), while the nutrition mapping must separately preserve their more precise source descriptions and per-ingredient states. This is a proposal, not a validated recipe. State weights must be the quantities actually consumed from the matching source foods; do not apply raw rice values to cooked rice grams. Cooking method, preparation time, serving practicality, source mapping, recipe rights and allergen/cross-contact review remain unverified. Every draft evidence flag must stay false until the existing accountable review workflow is completed.
