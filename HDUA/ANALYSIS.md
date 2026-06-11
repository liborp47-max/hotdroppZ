# HDUA — Analýza, úklid složek a rozhodnutí

> Datum: 2026-06-10. Autor: plan-manager (inline). Vstup: CEO master prompt „HDUA – MASTER PROMPT PRO".

---

## 1. Shrnutí

CEO master prompt zadal vybudovat **HDUA (HotDroppZ User App)** jako samostatný koncový
modul napojený na HDCC. Při analýze repozitáře se ukázalo, že **část HDUA už existuje**
pod jiným jménem (`frontend-web`), což zakládalo riziko duplicitní práce.

**Rozhodnutí CEO (2026-06-10):** HDUA bude **nativní aplikace (React Native / Expo)**.
Z `frontend-web` se reusne **pouze DB schéma + Content API**; `frontend-web` zůstává jako
veřejný web. Z toho plyne celý mission queue (14 misí, `HDUA-00` … `HDUA-13`) v
`NOTES/plan.json`.

---

## 2. Klíčové zjištění — duplicita „HDUA"

`frontend-web/CLAUDE.md` má v hlavičce doslova **„CLAUDE.md — HotDroppZ User App (HDUA)"**
a popisuje public-facing mobile-first **PWA (Next.js 16)**, která už obsahuje:

| Co frontend-web už má | Relevance pro nový HDUA |
|------------------------|--------------------------|
| `app/api/feed/` (čte feed_posts) | **Reuse jako Content API** (HDUA-02) |
| `app/api/actions/` (like/boost/follow) | Reuse logiky akcí (HDUA-02) |
| `drop/[id]`, `articles/[id]`, `artists`, `radar`, `search`, `profile`, `category`, `trending` | Referenční chování + datový kontrakt |
| Hlavní feed (FeedCard list + filtry) | **UI se NEpřenáší** (web ≠ native) |
| Supabase SSR auth | Schéma/role reuse; native řeší auth přes JWT |
| Stack: Next 16, Tailwind v4, Zustand, SWR | Web stack — pro native nepoužitelný 1:1 |

**Závěr:** `frontend-web` je hodnotný jako **web + zdroj kontraktu a DB**, ale jeho UI
vrstvu nelze v nativní appce použít (jiný framework). Proto „reuse DB + API, ne UI".

---

## 3. Rozhodnutí o složkách (spojit / nechat / smazat)

| Složka | Stav | Rozhodnutí | Akce / mise |
|--------|------|-----------|-------------|
| `frontend-web/` | Aktivní web (PWA, cíl hotdroppz.com), git-tracked | **NECHAT** jako veřejný web. NEpřejmenovávat. | Sdílet DB+API do HDUA (HDUA-01, HDUA-02). UI needitovat. |
| `HDUA/` | Nově založeno (zatím jen plán) | **VYTVOŘIT** jako Expo app | HDUA-00 |
| `lounchapp/` | 10 legacy `.bat/.ps1` start skriptů (z 13. 5.) | **ARCHIVOVAT** | Přesun → `ZALOHA/legacy-lounchapp/` (HDUA-00, sub-04) |
| `command-centrum/` | HDCC dashboard + pipeline | **NECHAT** beze změny | Dotčeno jen misemi HDUA-10/11 (monitor + preview) |
| `Louncher/` (root D:) | Build artefakty desktop .exe | **NECHAT** (ignorovat) | Desktop = až ve finále, ne teď |
| `backend/` (NestJS) | REST API | **ZVÁŽIT jako host Content API** | Rozhodnutí v HDUA-02, sub-01 |

> **Pozn. k desktopu:** dle CEO se teď pracuje v prohlížeči/dev; desktop `.exe` přijde až
> ve finále. HDUA jako Expo app cílí primárně na mobil; web preview řeší HDUA-11.

---

## 4. Architektura (cílový stav)

```
            ┌──────────────────────── HDCC (intelligence) ────────────────────────┐
            │  Scout → Parser → … → Trend Engine → Feed Generator → Publisher      │
            └───────────────┬─────────────────────────────────────────────────────┘
                            │  Events (publish / cache invalidation)
                            ▼
                  ┌───────────────────┐         feed_items (projekce nad feed_posts+posts)
                  │   Content API v1  │◄─────────  user_* tabulky (interakce, RLS)
                  │  /feed /post …    │
                  └─────────┬─────────┘
                            │  HTTPS + Supabase JWT (cursor pagination, ETag)
                            ▼
        ┌───────────────────────────────────────────────────────────┐
        │   HDUA (Expo / React Native)                              │
        │   Feed Engine (FlashList+infinite) → Feed Card →          │
        │   Post Detail (shared-element + continuous reader) →      │
        │   Player · Search · Profile · Alerts · Personalizace      │
        └───────────────────────────────────────────────────────────┘
                            ▲
              Live Preview (40%) uvnitř HDCC (HDUA-11) + Pipeline Monitor (HDUA-10)
```

---

## 5. Pořadí misí — proč právě takto (chronologie)

Pořadí respektuje fázový model plan-manageru
(**Foundation → Build → Validate → Launch → Scale**) a reálné závislosti:

1. **Foundation (00–02):** nelze stavět UI bez projektu, schématu a API.
   `00` scaffold → `01` DB (data) → `02` Content API (přístup k datům).
2. **Build (03–09):** `03` navigace (kostra) → `04` média (stavební kámen karet/detailu) →
   `05` Feed Engine (jádro) → `06` Feed Card (vizuál) → `07` Post Detail (retence) →
   `08` Player → `09` Personalizace (potřebuje feed + signály).
3. **Scale (10–12):** monitoring a analytika dávají smysl až když teče obsah a chodí uživatelé.
4. **Validate (13):** dokumentace je živá, ale finální konsolidace patří na konec.

**Kritická cesta „udrží u obrazovky":** `05 → 06 → 07`. Plynulý přechod feed→detail s
auto-navázáním dalšího postu (kombinace TikTok + Apple News) je hlavní návyková mechanika.

---

## 6. Rizika a otevřené otázky

| Riziko / otázka | Dopad | Doporučení |
|------------------|-------|------------|
| **Host Content API** (NestJS backend vs. Next route handlers) | Architektura, provoz | Rozhodnout na začátku HDUA-02. Pro native je čistší dedikovaný API host (backend). |
| **Embed přehrávání** (Spotify/YouTube) v RN | Media UX | Ověřit native SDK; WebView jako fallback (HDUA-04). |
| **Realtime škálování** (tisíce klientů) | Náklady, výkon | Začít Supabase realtime; sledovat limity, případně fan-out vrstva. |
| **GDPR signály** (personalizace/analytika) | Legal | Opt-out + retence od začátku (HDUA-09). Reuse jeden tracking, ne dva. |
| **iOS/Android účty + EAS** | Vydání | Vyřešit dřív, než dojde na HDUA-13 (deployment doc). |
| **Sdílené typy** mezi web/native/HDCC | Drift kontraktu | Single source of truth balíček (HDUA-00 sub-05, HDUA-02 sub-01). |

---

## 7. Co je hotovo touto iterací (plánovací)

- ✅ 14 misí `HDUA-*` zaneseno do `NOTES/plan.json` (`moduleId: "HDUA"`, `userMission: true`,
  `sequenceIndex` 200–213), validováno přes `validatePlanPayload`.
- ✅ Záloha `NOTES/plan.json.bak-pre-hdua-2026-06-10`.
- ✅ Idempotentní seeder `scripts/seed-hdua-missions.mjs` + generátor `scripts/gen-hdua-docs.mjs`.
- ✅ Dokumenty: `HDUA/README.md`, `HDUA/MISSIONS.md` (generováno), `HDUA/PROMPTS.md`, tento `ANALYSIS.md`.
- ⏳ **Neprovedeno (záměrně):** scaffold Expo appky, přesun `lounchapp`, jakýkoli kód —
  to je náplň misí `HDUA-00+`, spouštěj přes `PROMPTS.md`.

---

## 8. Doporučené další 3 kroky (RNS)

1. **Dnes:** rozhodnout host Content API (backend NestJS vs. Next) — odblokuje HDUA-02 a tím celý feed.
2. **Tento týden:** spustit `HDUA-00` (scaffold) podle `PROMPTS.md` — založí app a uklidí `lounchapp`.
3. **Tento týden:** potvrdit datový kontrakt `feed_items` proti reálným `feed_posts` (HDUA-01), ať API nestaví na špatném tvaru.
