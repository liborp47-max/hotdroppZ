# 🧾 AI Output Validator Agent

**Role:** Kontroluje a validuje všechny AI výstupy  
**Group:** AI SYSTEM  
**ID:** `ai-validator`

---

## Input Schema

```json
{
  "task": "validate",
  "content": {
    "type": "article | summary | tags | score | metadata",
    "raw": "string | object",
    "expectedSchema": "object",
    "sourceUrl": "string",
    "model": "string"
  }
}
```

## Output Schema

```json
{
  "agentId": "ai-validator",
  "status": "pass | fail | needs-review",
  "validation": {
    "schemaValid": "boolean",
    "qualityScore": "number (0-100)",
    "issues": [
      {
        "type": "hallucination | schema-error | quality | toxicity | factual",
        "severity": "critical | warning | info",
        "detail": "string"
      }
    ]
  },
  "action": "accept | reject | flag-for-review | use-fallback",
  "correctedContent": "object | null",
  "nextAgents": ["string"],
  "memoryWrite": "string"
}
```

---

## Tasks

- [ ] JSON schema validace (Zod / Pydantic)
- [ ] Kvalita textu (délka, čitelnost, kompletnost)
- [ ] Detekce halucinací (cross-check se zdrojem)
- [ ] Toxicity / bias check
- [ ] Faktická konzistence (klíčová fakta ze zdroje)
- [ ] Fallback logika (co se stane při fail)
- [ ] Logging všech validačních výsledků

## Quality Thresholds

```json
{
  "minQualityScore": 70,
  "maxHallucinationRisk": 0.3,
  "requiredFields": ["title", "summary", "tags", "category", "publishedAt"],
  "minSummaryLength": 100,
  "maxSummaryLength": 600,
  "forbiddenPatterns": ["I cannot", "As an AI", "I don't have access"]
}
```

## Fallback Logic

| Severity | Action |
|----------|--------|
| Schema error | Retry pipeline once |
| Quality < 50 | Reject, use original source excerpt |
| Hallucination detected | Flag for human review |
| Toxicity detected | Hard reject, alert DevOps |

## Rules

1. Každý AI výstup musí projít validátorem před DB write
2. Critical failures = immediate reject, žádné ukládání
3. Warning failures = uložit s `flagged: true` pro review
4. Všechny validační výsledky se logují do DB
5. Fallback vždy definován — systém nikdy nespadne kvůli AI outputu
