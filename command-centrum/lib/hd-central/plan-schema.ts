/**
 * plan-schema.ts — AUD-CODE-002. Runtime validation for plan.json payloads.
 *
 * plan.json is the CEO source of truth, written by ~21 routes and parsed as
 * `JSON.parse(...) as Plan` with no validation. A malformed PUT body (or a
 * corrupted file) could silently poison the whole mission timeline. This zod
 * schema gates the STRUCTURE (missions is an array of objects each with a string
 * id). It is intentionally a gate, not a transformer — callers keep using the
 * original object on success so no unknown fields are stripped.
 */

import { z } from 'zod'

const SubMissionSchema = z
  .object({ id: z.string().min(1) })
  .catchall(z.unknown())

const MissionSchema = z
  .object({
    id: z.string().min(1),
    subMissions: z.array(SubMissionSchema).optional(),
  })
  .catchall(z.unknown())

export const PlanSchema = z
  .object({
    version: z.number().optional(),
    updatedAt: z.string().optional(),
    missions: z.array(MissionSchema),
    tasks: z.array(z.unknown()).optional(),
  })
  .catchall(z.unknown())

export type PlanShape = z.infer<typeof PlanSchema>

/** Validate a parsed JSON payload. Returns zod's discriminated result. */
export function validatePlanPayload(data: unknown) {
  return PlanSchema.safeParse(data)
}
