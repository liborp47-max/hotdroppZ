# HotDroppZ Agent System

> AI software engineering tým, který staví produkt za tebe.

---

## Princip

Každý agent:
- má přesný `input` a `output` (JSON)
- neimprovizuje mimo svoji roli
- komunikuje přes JSON objekty
- zapisuje výstupy do shared memory

---

## Skupiny a Agenti

### 🔵 CORE SYSTEM
| Agent | ID | Role |
|-------|----|------|
| System Architect | `system-architect` | Architektura, tech decisions, diagramy |
| Backend Engineer | `backend-engineer` | REST/GraphQL API, auth, feed engine |
| Database Engineer | `db-engineer` | PostgreSQL schema, Redis, indexy |
| API Integration | `api-integration` | Social APIs, external services, connectors |

### 🟢 FRONTEND & APP
| Agent | ID | Role |
|-------|----|------|
| Web Frontend | `frontend-engineer` | Next.js, UI komponenty, SSR, SEO |
| Mobile App | `mobile-engineer` | React Native, swipe feed, push notifs |
| UI/UX Designer | `ui-ux-designer` | Design system, UX flow, tokens |

### 🟠 AI SYSTEM
| Agent | ID | Role |
|-------|----|------|
| AI Pipeline Engineer | `ai-pipeline` | LangGraph orchestrace, job queue, memory |
| Prompt Engineer | `prompt-engineer` | Prompty, tone-of-voice, JSON schemas |
| AI Output Validator | `ai-validator` | Validace, hallucination detection, fallback |

### 🔴 INFRASTRUCTURE
| Agent | ID | Role |
|-------|----|------|
| DevOps | `devops` | Docker, CI/CD, hosting, monitoring |
| Performance | `performance` | Caching, latency, DB query optimalizace |
| Security | `security` | Auth, JWT, rate limiting, OWASP audit |

### 🟣 PRODUCT & CONTROL
| Agent | ID | Role |
|-------|----|------|
| Product Manager | `product-manager` | Backlog, roadmap, sprint plánování |
| QA / Testing | `qa` | Unit, API, E2E testy, bug reporting |
| Analytics | `analytics` | Event tracking, funnely, growth metriky |

---

## Development Flow

```
Product Manager      → definuje sprint a specifikace
       ↓
System Architect     → navrhuje architekturu
       ↓
DB Engineer          → schéma a migrace
       ↓
Backend Engineer     → API a business logika
       ↓
Frontend + Mobile    → UI a app
       ↓
AI Pipeline          → AI systém
       ↓
DevOps               → deploy na staging
       ↓
QA                   → testování
       ↓
Security             → security review
       ↓
Performance          → optimalizace
       ↓
DevOps               → production deploy
       ↓
Analytics            → feedback loop
```

---

## Soubory

```
agents/
├── AGENTS.md                  ← tento soubor (index)
├── core/
│   ├── types.ts               ← sdílené TypeScript typy
│   ├── orchestrator.ts        ← dispatchuje tasky mezi agenty
│   ├── task-queue.ts          ← prioritní fronta tasků
│   └── memory-system.ts       ← sdílená paměť agentů
├── system-architect/agent.md
├── backend-engineer/agent.md
├── db-engineer/agent.md
├── api-integration/agent.md
├── frontend-engineer/agent.md
├── mobile-engineer/agent.md
├── ui-ux-designer/agent.md
├── ai-pipeline/agent.md
├── prompt-engineer/agent.md
├── ai-validator/agent.md
├── devops/agent.md
├── performance/agent.md
├── security/agent.md
├── product-manager/agent.md
├── qa/agent.md
└── analytics/agent.md
```
