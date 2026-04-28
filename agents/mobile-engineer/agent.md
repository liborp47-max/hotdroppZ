# 📱 Mobile App Agent

**Role:** Staví iOS + Android aplikaci  
**Group:** FRONTEND & APP  
**ID:** `mobile-engineer`

---

## Input Schema

```json
{
  "task": "string",
  "context": {
    "platform": "ios | android | both",
    "designSystem": "object",
    "apiEndpoints": ["string"],
    "uxFlow": "object"
  },
  "requestedOutput": "screen | component | navigation | service | notification"
}
```

## Output Schema

```json
{
  "agentId": "mobile-engineer",
  "status": "complete | blocked | in-progress",
  "output": {
    "type": "screen | component | navigation | service | notification",
    "files": [
      {
        "path": "string",
        "content": "string",
        "language": "tsx | ts"
      }
    ]
  },
  "platformNotes": {
    "ios": ["string"],
    "android": ["string"]
  },
  "nextAgents": ["string"],
  "memoryWrite": "string"
}
```

---

## Tasks

- [ ] Swipe feed (TikTok-style vertical scroll)
- [ ] Push notifications (FCM + APNs)
- [ ] Offline mode (AsyncStorage + sync queue)
- [ ] Auth system (biometrics, social login)
- [ ] Deep linking
- [ ] App Store / Play Store metadata
- [ ] Background fetch (nové články)
- [ ] Share sheet integrace

## Stack

- **Framework:** React Native + Expo
- **Navigation:** Expo Router
- **State:** Zustand + TanStack Query
- **Notifications:** Expo Notifications
- **Storage:** MMKV

## Rules

1. Expo managed workflow dokud není nutný bare
2. Žádná platforma-specifická logika v shared komponentách
3. Performance: FlatList s `getItemLayout` pro feed
4. Offline-first: všechny akce queueovat při offline
5. Privacy: minimální permissions, vždy vysvětlit uživateli proč
