# HDUA — HotDroppZ User App

> **Realtime Music Intelligence Platform** pro rap, hudbu, kulturu, fashion, celebrity, drama a globální trendy.
> Koncová aplikace pro uživatele. HDCC zůstává backend intelligence systém.

📚 **Dokumentace:** [`docs/`](docs/README.md) — architektura, DB, feed engine, API, UI systém, deployment.

---

## Co je HDUA

HDUA (**HotDroppZ User App**) je **samostatný nativní mobilní modul** (React Native / Expo),
plně oddělený od HDCC. Konzumuje živý obsah z AI pipeline a zobrazuje ho jako nekonečný
inteligentní feed s plynulým přechodem do detailu a personalizovaným doporučováním.

Inspirace (ne kopie): TikTok · Instagram · Spotify · X · Apple News.
Cíl: **moderní, promakaná aplikace, která udrží člověka u obrazovky.**

```
HDCC  →  Events  →  Content API  →  HDUA  →  User
(intelligence)   (bridge)      (read API)  (Expo app)
```

---

## Stack (rozhodnuto)

| Vrstva | Volba | Proč |
|--------|-------|------|
| Runtime | **React Native (Expo)** | Skutečně nativní pocit z mockupů (iOS/Android), gesta, 60fps |
| Routing | **Expo Router** | File-based, deep linking, sdílené layouty |
| Data | **TanStack Query** (infinite) | Cursor pagination, cache, prefetch pro nekonečný feed |
| Stav | **Zustand** | Lehký globální stav (player, session) |
| Seznamy | **FlashList** | Recyklace = plynulý feed na tisících položek |
| Animace | **Reanimated + Gesture Handler** | Shared-element expand feed→detail |
| Média | **expo-image, expo-av** | Cache, blurhash, audio/video preview |
| Auth/DB | **Supabase JS** | Sdíleno s HDCC; JWT do Content API |

> **frontend-web zůstává jako veřejný web (PWA).** Z něj HDUA reusne **jen DB schéma + Content API**, ne kód UI.
> Detaily v [ANALYSIS.md](ANALYSIS.md).

---

## Struktura modulu

```
SYSTEM/hotdroppz/HDUA/
  src/
    app/            Expo Router (tabs, layouty, auth gate)
    screens/        Obrazovky
    components/     Sdílené UI (cards/, media/, shared/)
    feed/           Feed Engine (virtualizace, infinite query, type registry)
    posts/          Post Detail Engine + continuous reader
    profiles/       Profil + historie
    search/         Vyhledávání
    notifications/  Alerts + notifikace
    settings/       Nastavení
    player/         Globální audio přehrávač
    analytics/      Klientský tracking signálů
    api/            Klient Content API + recommend
    hooks/  stores/  utils/  types/  styles/  assets/
  database/         HDUA migrace (user_* tabulky, feed_items projekce)
  docs/             HDUA_ARCHITECTURE / DATABASE / FEED_ENGINE / API / UI_SYSTEM / DEPLOYMENT
  tests/  public/
```

---

## Jak číst tento plán

1. **[MISSIONS.md](MISSIONS.md)** — 14 misí seřazených chronologicky (proč/jak, success criteria, sub-kroky).
2. **[PROMPTS.md](PROMPTS.md)** — ready-to-run prompt pro každou misi (zkopíruj a spusť).
3. **[ANALYSIS.md](ANALYSIS.md)** — analýza, úklid složek (frontend-web/lounchapp), rizika, otevřené otázky.

Mise jsou zároveň zaneseny **v systému** v `NOTES/plan.json` (`missions[]`), označené:
- `id` prefix **`HDUA-`** (`HDUA-00-SCAFFOLD` … `HDUA-13-DOCS`)
- `moduleId: "HDUA"`, `userMission: true`
- `sequenceIndex` 200–213 (chronologické pořadí v Mission Timeline)

Re-seed kdykoli: `node scripts/seed-hdua-missions.mjs` (idempotentní).

---

## Pořadí (chronologicky, dependency-correct)

| # | Mise | Fáze | Prio |
|---|------|------|------|
| 00 | Scaffold Expo app + úklid složek | Foundation | P0 |
| 01 | Databázová vrstva | Foundation | P0 |
| 02 | Content API + HDCC bridge | Foundation | P0 |
| 03 | App shell + spodní navigace | Build | P0 |
| 04 | Media vrstva | Build | P1 |
| 05 | Feed Engine (klient) | Build | P0 |
| 06 | Feed Card layout | Build | P0 |
| 07 | Post Detail + plynulý přechod | Build | P0 |
| 08 | Globální přehrávač | Build | P1 |
| 09 | Personalizace / doporučování | Build | P1 |
| 10 | HDCC Live Pipeline Monitor | Scale | P1 |
| 11 | HDUA Live Preview v HDCC | Scale | P2 |
| 12 | User Analytics | Scale | P2 |
| 13 | Dokumentace | Validate | P2 |

**Kritická cesta retence:** 05 → 06 → 07 (feed → karta → plynulý detail s auto-navázáním dalšího postu).
To je mechanika, která „udrží člověka u obrazovky".
