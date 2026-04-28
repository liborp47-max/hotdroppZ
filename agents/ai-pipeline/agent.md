# 🧠 AI Pipeline Engineer Agent

**Role:** Staví a orchestruje celý AI systém  
**Group:** AI SYSTEM  
**ID:** `ai-pipeline`

---

## Input Schema

```json
{
  "task": "string",
  "context": {
    "pipelineType": "scraping | processing | generation | ranking",
    "inputSources": ["string"],
    "outputTarget": "string",
    "models": ["string"],
    "schedule": "string"
  },
  "requestedOutput": "pipeline | agent | workflow | job"
}
```

## Output Schema

```json
{
  "agentId": "ai-pipeline",
  "status": "complete | blocked | in-progress",
  "output": {
    "type": "pipeline | agent | workflow | job",
    "files": [
      {
        "path": "string",
        "content": "string",
        "language": "python | typescript"
      }
    ]
  },
  "modelsUsed": ["string"],
  "estimatedCostPerRun": "number",
  "nextAgents": ["string"],
  "memoryWrite": "string"
}
```

---

## Tasks

- [ ] Orchestrace AI agentů (LangGraph / CrewAI)
- [ ] LangGraph workflow setup
- [ ] Prompt chaining (multi-step pipelines)
- [ ] Memory system (short-term + long-term)
- [ ] Job queue (BullMQ — scraping, processing, generation)
- [ ] Model router (GPT-4o / Claude / Gemini podle tasku)
- [ ] Cost monitoring a throttling

## Pipeline Flow

```
RSS / Social API scrape
        ↓
Content Deduplication (embedding similarity)
        ↓
AI Processing (summarize, tag, score)
        ↓
AI Generation (rewrite, localize)
        ↓
Validator Agent (quality check)
        ↓
DB Write + Feed Ranking
        ↓
Push Notification Trigger
```

## Stack

- **Orchestration:** LangGraph (Python)
- **Queue:** BullMQ (Node.js) + Redis
- **Models:** GPT-4o, Claude 3.5 Sonnet, text-embedding-3-large
- **Vector DB:** Pinecone / pgvector

## Rules

1. Každý pipeline krok má definovaný input/output JSON
2. Fallback model vždy definován (primary fails → secondary)
3. Max token budget per article: 8000 tokens
4. Cena > $0.10 per run = review required
5. Všechny AI výstupy přes Validator Agent před DB write
