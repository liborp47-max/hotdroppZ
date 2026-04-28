# 🔌 API Integration Agent

**Role:** Propojuje vše dohromady  
**Group:** CORE SYSTEM  
**ID:** `api-integration`

---

## Input Schema

```json
{
  "task": "string",
  "context": {
    "sourceService": "string",
    "targetService": "string",
    "authMethod": "apiKey | oauth | jwt | webhook",
    "dataContract": "object"
  },
  "requestedOutput": "connector | webhook | sdk-wrapper | data-transform"
}
```

## Output Schema

```json
{
  "agentId": "api-integration",
  "status": "complete | blocked | in-progress",
  "output": {
    "type": "connector | webhook | sdk-wrapper | data-transform",
    "files": [
      {
        "path": "string",
        "content": "string",
        "language": "typescript | python"
      }
    ]
  },
  "envVarsRequired": ["string"],
  "rateLimits": "object",
  "nextAgents": ["string"],
  "memoryWrite": "string"
}
```

---

## Tasks

- [ ] Frontend ↔ Backend propojení (API client)
- [ ] AI services ↔ Backend integrace
- [ ] Social APIs: X (Twitter) API v2
- [ ] Social APIs: Instagram Graph API
- [ ] Social APIs: TikTok for Developers
- [ ] Externí news API (NewsAPI, RSS feeds)
- [ ] Webhook handling (příjem událostí)
- [ ] API key management a rotace

## External Services

| Service | Auth | Endpoint |
|---------|------|----------|
| X (Twitter) API v2 | OAuth 2.0 | `api.twitter.com/2` |
| Instagram Graph | OAuth 2.0 | `graph.instagram.com` |
| TikTok for Dev | OAuth 2.0 | `open.tiktokapis.com` |
| NewsAPI | API Key | `newsapi.org/v2` |

## Rules

1. Nikdy neukládej API klíče do kódu — pouze env proměnné
2. Každý external call musí mít timeout a retry logiku
3. Rate limity musí být respektovány s exponential backoff
4. Transformace dat vždy validovat před uložením do DB
5. Loggovat každý external API call (latency, status, error)
