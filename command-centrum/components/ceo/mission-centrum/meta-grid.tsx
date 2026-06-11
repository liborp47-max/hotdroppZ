'use client'

import type { Mission } from '@/lib/hd-central/types'
import { InfoBadge } from '@/components/info/info-badge'

interface MetaGridProps {
  mission: Mission
}

/**
 * Three-box meta layout:
 *  ┌ Problem ┐┌ Why ┐┌ Status & owner ┐
 */
export function MetaGrid({ mission }: MetaGridProps) {
  const lifecycleStatus = mission.lifecycleStatus ?? 'PLAN'
  const problem = (mission.description ?? mission.purpose ?? '').trim()
  const why = (mission.rationale ?? mission.purpose ?? '').trim()
  const owner = inferOwner(mission)

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Box title="Problem">
        {problem ? (
          <p className="text-[12px] leading-relaxed text-[#D0D0D0]">{problem}</p>
        ) : (
          <p className="text-[11px] italic text-[#6E6E6E]">No description.</p>
        )}
      </Box>

      <Box title="Why">
        {why ? (
          <p className="text-[12px] italic leading-relaxed text-[#F59E0B]">{why}</p>
        ) : (
          <p className="text-[11px] italic text-[#6E6E6E]">No rationale.</p>
        )}
      </Box>

      <Box title="Status & owner">
        <dl className="space-y-1.5 text-[11px]">
          <Row label="Status">
            <InfoBadge term={`mission-status-${lifecycleStatus}`}>
              <span
                className={`plastic-chip px-1.5 py-0.5 font-semibold ${
                  lifecycleStatus === 'MISSION_DONE'
                    ? 'text-[#1AEE99] border-[#00E085]/40'
                    : lifecycleStatus === 'SIMULATED_ONLY'
                      ? 'text-[#FFB020] border-[#FFB020]/50'
                      : 'text-[#E8E8E8]'
                }`}
              >
                {lifecycleStatus}
              </span>
            </InfoBadge>
          </Row>
          <Row label="Owner">
            <span className="font-mono text-[#1AEE99]">@{owner}</span>
          </Row>
          {mission.moduleId && (
            <Row label="Module">
              <span className="font-mono text-[#A8A8A8]">{mission.moduleId}</span>
            </Row>
          )}
          {mission.modulePath && (
            <Row label="Path">
              <span
                className="font-mono text-[10px] text-[#00B4FF] break-all"
                title={mission.modulePath}
              >
                {mission.modulePath}
              </span>
            </Row>
          )}
          {mission.estimatedComplexity && (
            <Row label="Complexity">
              <span className="font-mono text-[#A8A8A8]">{mission.estimatedComplexity}</span>
            </Row>
          )}
        </dl>
      </Box>
    </section>
  )
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="plastic-card-hi p-3">
      <div className="section-title mb-2">{title}</div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-20 shrink-0 text-[10px] uppercase tracking-widest text-[#6E6E6E]">
        {label}
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}

/**
 * Best-effort owner derivation: explicit moduleId first, else first sub-mission owner,
 * else mission domain hint, else "ceo".
 */
function inferOwner(mission: Mission): string {
  const subOwner = (mission.subMissions ?? []).find((s) => s.owner)?.owner
  if (subOwner) return subOwner
  if (mission.moduleId) return mission.moduleId.toLowerCase()
  const d = mission.domains?.[0]
  if (d) return d.toLowerCase()
  return 'ceo'
}
