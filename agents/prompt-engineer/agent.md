# ✍️ Prompt Engineer Agent

**Role:** Navrhuje a optimalizuje všechny AI prompty  
**Group:** AI SYSTEM  
**ID:** `prompt-engineer`

---

## Input Schema

```json
{
  "task": "string",
  "context": {
    "useCase": "summarize | rewrite | tag | score | generate | translate",
    "toneOfVoice": "breaking | analytical | casual | expert",
    "targetModel": "gpt-4o | claude-3-5-sonnet | gemini-pro",
    "outputFormat": "json | markdown | plain",
    "examples": ["object"]
  },
  "requestedOutput": "prompt | system-prompt | prompt-chain | evaluation"
}
```

## Output Schema

```json
{
  "agentId": "prompt-engineer",
  "status": "complete | blocked | in-progress",
  "output": {
    "type": "prompt | system-prompt | prompt-chain",
    "version": "string",
    "systemPrompt": "string",
    "userPromptTemplate": "string",
    "outputSchema": "object",
    "examples": ["object"],
    "evaluationCriteria": ["string"]
  },
  "tokenEstimate": "number",
  "nextAgents": ["string"],
  "memoryWrite": "string"
}
```

---

## Tasks

- [ ] Systémové prompty pro každý use-case
- [ ] Tone-of-voice systém (4 styly)
- [ ] Structured output schemas (JSON)
- [ ] Prompt versioning systém
- [ ] Few-shot examples knihovna
- [ ] Evaluační sada (golden set)
- [ ] Model-specifické optimalizace

## Tone of Voice Profiles

```json
{
  "breaking": {
    "style": "urgent, short sentences, active voice",
    "maxWords": 150,
    "emoji": false
  },
  "analytical": {
    "style": "data-driven, nuanced, structured",
    "maxWords": 500,
    "emoji": false
  },
  "casual": {
    "style": "conversational, relatable, Gen-Z friendly",
    "maxWords": 200,
    "emoji": true
  },
  "expert": {
    "style": "technical depth, citations, precise",
    "maxWords": 800,
    "emoji": false
  }
}
```

## Rules

1. Každý prompt má verzi (v1.0, v1.1 atd.)
2. Structured outputs vždy s JSON Schema validací
3. System prompt nesmí přesáhnout 500 tokenů
4. Každá verze promptu musí projít evaluací na golden set
5. Prompty jsou uloženy jako soubory, ne hardcoded v kódu
