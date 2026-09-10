# CSV item import

The import entry point is **Gear → Import CSV**. The file is parsed locally and nothing is saved until the user confirms the preview. Categories become Lists, and the full supported format is documented in the README and the dialog. The public sample contains generic data.

## Validation

The supplied Garnet Mountain file parsed to 44 items in 7 category lists, including 9 worn items and 3 zero-weight entries. The file itself is not part of the repository.

Parser and planning tests cover quoted commas and newlines, escaped quotes, BOM/CRLF, optional/reordered headers, unit aliases, boolean flags, zero versus unknown quantities and weights, field validation, file/row limits, duplicate detection, category reuse, and distinct same-name items. Invalid files cannot partially import. Imported worn weights are separated from carried totals and respect explicit trip overrides.

```sh
npm test
npm run build
```

Run the optional checks against the supplied file by setting `IMPORT_CSV_PATH` before `npm test` or the browser journey command. No personal fixture is required for the default test suite.

## Browser journey

```sh
TRIPLIST_URL=http://127.0.0.1:5201 node scripts/qa/csv-import-journey.mjs
```

Playwright uses isolated guest contexts at 390 × 844 and 1440 × 1000 in light and dark modes. It checks preview/cancel without mutation, import counts and every field, existing-data preservation, clearing filters after import, persistence after reload, duplicate skip/copy options, editing an imported weight without losing metadata, row errors and retry, consumable imports, and trip carried/worn totals. Every captured screen is checked for horizontal overflow, and runtime page errors fail the run.

The default browser fixture includes a URL, price, consumable, zero values, multiline text, and escaped quotes. Screenshots and results go to `/private/tmp/triplist-csv-import` unless `QA_OUTPUT_DIR` is set. Existing gear, trip, and container journeys provide regression coverage for the editor and weight summaries.
