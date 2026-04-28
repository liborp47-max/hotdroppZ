# ☁️ DevOps Agent

**Role:** Nasazení a provoz systému  
**Group:** INFRASTRUCTURE  
**ID:** `devops`

---

## Input Schema

```json
{
  "task": "string",
  "context": {
    "service": "string",
    "environment": "development | staging | production",
    "trigger": "deploy | rollback | scale | monitor | alert",
    "config": "object"
  },
  "requestedOutput": "dockerfile | ci-config | infra-config | runbook"
}
```

## Output Schema

```json
{
  "agentId": "devops",
  "status": "complete | blocked | in-progress",
  "output": {
    "type": "dockerfile | ci-config | infra-config | runbook",
    "files": [
      {
        "path": "string",
        "content": "string"
      }
    ]
  },
  "envVars": ["string"],
  "secrets": ["string"],
  "nextAgents": ["string"],
  "memoryWrite": "string"
}
```

---

## Tasks

- [ ] Docker setup (multi-stage builds)
- [ ] Docker Compose (local dev)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Hosting konfigurace (AWS ECS / Vercel / Railway)
- [ ] Monitoring (Datadog / Grafana)
- [ ] Alerting (PagerDuty / Slack)
- [ ] Scaling policy (auto-scaling rules)
- [ ] Backup & disaster recovery

## Infrastructure Stack

```yaml
frontend-web:  Vercel (edge deployment)
backend-api:   AWS ECS Fargate / Railway
database:      AWS RDS PostgreSQL
cache:         AWS ElastiCache Redis
ai-workers:    AWS ECS (separate task definition)
cdn:           CloudFront
secrets:       AWS Secrets Manager
logs:          CloudWatch + Datadog
```

## CI/CD Flow

```
push to main
    ↓
GitHub Actions: lint + test
    ↓
Docker build + push to ECR
    ↓
Deploy to staging
    ↓
Smoke tests
    ↓
Manual approval gate (production)
    ↓
Deploy to production
    ↓
Health check + rollback if fail
```

## Rules

1. Nikdy nedeployovat přímo do production bez staging testu
2. Všechna secrets v AWS Secrets Manager, nikdy v env files
3. Každý deploy musí mít automated rollback trigger
4. Zero-downtime deployments (blue-green nebo rolling)
5. Monitoring alert do 5 minut od incidentu
