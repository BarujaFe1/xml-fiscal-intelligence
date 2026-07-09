# AI / RAG

## Status

Mock provider in `src/modules/ai`.

```env
ENABLE_AI=false
AI_PROVIDER=mock
ENABLE_DATA_MASKING=true
OPENAI_API_KEY=
XAI_API_KEY=
```

## Safety

- No external calls when mock / `ENABLE_AI=false`  
- `assertSafeSelectSql` allows only SELECT  
- Answers must cite limitations — never definitive tax advice  
- Mask identifiers before any future external provider  

## UI

`/app/ai` — chat mock + SQL preview guard.
