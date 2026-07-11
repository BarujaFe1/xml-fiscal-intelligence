# Import Security

Central controls live in:

- `src/lib/import/limits.ts` — `IMPORT_LIMITS`
- `src/lib/import/zip-security.ts` — path sanitization + budget checks
- `src/lib/zip/extract.ts` — ZIP extraction wiring

## Threats mitigated

| Threat | Control |
| ------ | ------- |
| Zip Slip / `..` | `sanitizeZipEntryPath` |
| Absolute / UNC paths | Rejected |
| Null byte | Rejected |
| Dangerous extensions | Blocklist |
| Too many files | `maxFiles` |
| Oversized member | `maxSingleFileBytes` |
| Compression ratio | `maxCompressionRatio` |
| XXE | `processEntities: false` in XMLParser |

## Not yet automated

- Nested ZIP bomb exhaustion beyond ratio heuristic
- Full XXE entity-expansion fixture suite in CI (planned)
- Plan-based limit overrides from entitlements (architecture ready)

## Tests

`tests/unit/zip.test.ts` + `tests/unit/hardening-phase-b.test.ts` (budget helpers can be extended).
