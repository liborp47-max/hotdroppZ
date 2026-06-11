/**
 * Factory Coordinator V2 - Template-Driven Orchestration
 * Integrates template system with Writer, Enricher, Creator.
 *
 * UM-FACTORY: now state-machine driven — Enrichment and Writer run in
 * parallel (the coordinator state machine confirms they share no dependency),
 * and a quality gate evaluates the assembled story before Finals export.
 */

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { pickTemplate, createTemplateInstance, getModuleInstructions, validateTemplateInstance } from '@/lib/pipeline/templates/picker'
import { bindWriterFields, bindEnricherFields, exportToFeedPost, getInstanceState } from '@/lib/pipeline/templates/binder'
import { runEnrichmentPipeline } from '@/lib/pipeline/enrichment'
import { generateArticleVariants } from '@/lib/pipeline/writer'
import type { TemplateInstance } from '@/lib/pipeline/templates/base'
import {
  computeExecutionPlan,
  isParallelizable,
  type FactoryStageId,
} from '@/lib/factory/coordinator-state-machine'
import { evaluateQualityGate, type QualityGateResult } from '@/lib/factory/quality-gate'

type PipelineDbClient = Awaited<ReturnType<typeof createClient>> | NonNullable<ReturnType<typeof createAdminClient>>

type WriterArticle = Awaited<ReturnType<typeof generateArticleVariants>>

export interface FactoryV2Input {
  clusterId?: string
  clusterIds?: string[]
  skipEnrichment?: boolean
  skipCreator?: boolean
}

export interface FactoryV2Result {
  id: string
  clusterId: string
  templateType: string
  templateId: string
  status: 'success' | 'partial' | 'error'
  /** Parallel execution batches derived from the coordinator state machine. */
  executionPlan: FactoryStageId[][]
  stages: {
    analysis: { status: string; reasoning: string; templateSelected: string }
    enrichment: { status: string; itemsEnriched: number; fieldsRecovered: number }
    writer: { status: string; articlesGenerated: number; fieldsFilled: number }
    creator: { status: string; graphicsGenerated: number; fieldsFilled: number }
    binding: { status: string; completeness: number; missingFields: string[] }
  }
  /** Quality-gate verdict on the assembled story. Null until Writer has run. */
  qualityGate: QualityGateResult | null
  instance: TemplateInstance | null
  feedContent: any | null
  completedAt: string
  totalProcessingMs: number
}

export class FactoryCoordinatorV2 {
  private db: PipelineDbClient
  private runId: string

  constructor(db: PipelineDbClient) {
    this.db = db
    this.runId = `factory-v2-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  /**
   * Main orchestration flow.
   * 1. Fetch cluster + pick template + create instance
   * 2. Run Enrichment and Writer IN PARALLEL (state-machine sanctioned)
   * 3. Bind results, run Creator
   * 4. Quality gate + completeness validation
   * 5. Export to feed
   */
  async orchestrate(input: FactoryV2Input): Promise<FactoryV2Result> {
    const startTime = Date.now()
    const executionPlan = computeExecutionPlan()

    const clusterId = input.clusterId || input.clusterIds?.[0]
    if (!clusterId) {
      return this.errorResult('No cluster ID provided', startTime, executionPlan)
    }

    const { data: cluster, error: clusterError } = await this.db
      .from('story_clusters')
      .select('*')
      .eq('id', clusterId)
      .single()

    if (clusterError || !cluster) {
      return this.errorResult(`Failed to fetch cluster: ${clusterError?.message}`, startTime, executionPlan)
    }

    const result: FactoryV2Result = {
      id: this.runId,
      clusterId,
      templateType: 'unknown',
      templateId: '',
      status: 'success',
      executionPlan,
      stages: {
        analysis: { status: 'pending', reasoning: '', templateSelected: '' },
        enrichment: { status: 'pending', itemsEnriched: 0, fieldsRecovered: 0 },
        writer: { status: 'pending', articlesGenerated: 0, fieldsFilled: 0 },
        creator: { status: 'pending', graphicsGenerated: 0, fieldsFilled: 0 },
        binding: { status: 'pending', completeness: 0, missingFields: [] },
      },
      qualityGate: null,
      instance: null,
      feedContent: null,
      completedAt: new Date().toISOString(),
      totalProcessingMs: 0,
    }

    try {
      // Step 1: Analyze & pick template
      const pickResult = pickTemplate({
        id: cluster.id,
        category: cluster.category,
        title: cluster.title,
        main_entity: cluster.main_entity,
        merged_context: cluster.merged_context,
        source_links: cluster.source_links || {},
        images: cluster.images || {},
      })

      result.templateType = pickResult.selectedTemplate.type
      result.templateId = pickResult.selectedTemplate.id
      result.stages.analysis = {
        status: 'success',
        reasoning: pickResult.reasoning,
        templateSelected: pickResult.selectedTemplate.name,
      }

      // Step 2: Create template instance
      const instance = createTemplateInstance(
        {
          id: cluster.id,
          category: cluster.category,
          title: cluster.title,
          main_entity: cluster.main_entity,
          merged_context: cluster.merged_context,
          source_links: cluster.source_links || {},
          images: cluster.images || {},
          metadata: cluster.metadata,
        },
        pickResult.selectedTemplate.id
      )

      // ── Steps 3+4: Enrichment ∥ Writer ───────────────────────────────────
      // The coordinator state machine confirms Writer and Enrichment share no
      // dependency, so their slow AI/network calls run concurrently. Binds are
      // applied sequentially afterwards to avoid concurrent instance mutation.
      const parallelOk = isParallelizable('writer', 'enrichment')

      const enrichmentTask = async (): Promise<{ fields: Record<string, any>; itemsEnriched: number } | null> => {
        if (input.skipEnrichment) return null
        try {
          const enrichmentResult = await runEnrichmentPipeline(this.db, {})
          const { data: enrichedCluster } = await this.db
            .from('story_clusters')
            .select('*')
            .eq('id', clusterId)
            .single()
          if (!enrichedCluster) return null

          const enrichedFields: Record<string, any> = {}
          if (enrichedCluster.spotify_url) enrichedFields.spotify_url = enrichedCluster.spotify_url
          if (enrichedCluster.youtube_url) enrichedFields.youtube_url = enrichedCluster.youtube_url
          if (enrichedCluster.genius_url) enrichedFields.genius_url = enrichedCluster.genius_url
          if (enrichedCluster.apple_music_url) enrichedFields.apple_music_url = enrichedCluster.apple_music_url
          enrichedFields.tags = [
            ...(enrichedCluster.category ? [enrichedCluster.category] : []),
            ...(enrichedCluster.main_entity ? [String(enrichedCluster.main_entity).toLowerCase().replace(/\s+/g, '_')] : []),
          ]
          enrichedFields.source_links = [
            enrichedCluster.spotify_url,
            enrichedCluster.youtube_url,
            enrichedCluster.genius_url,
            enrichedCluster.apple_music_url,
          ].filter(Boolean)
          enrichedFields.metadata = {
            source_count: enrichedCluster.source_count ?? 0,
            confidence: enrichedCluster.confidence ?? 0,
            image_url: enrichedCluster.selected_image_url ?? enrichedCluster.image_url ?? null,
          }
          return { fields: enrichedFields, itemsEnriched: enrichmentResult.enriched }
        } catch {
          result.stages.enrichment = { status: 'error', itemsEnriched: 0, fieldsRecovered: 0 }
          return null
        }
      }

      const writerTask = async (): Promise<WriterArticle | null> => {
        const writerFields = getModuleInstructions(pickResult.selectedTemplate, 'writer')
        if (writerFields.length === 0) {
          result.stages.writer = { status: 'skipped', articlesGenerated: 0, fieldsFilled: 0 }
          return null
        }
        try {
          return await generateArticleVariants({
            id: cluster.id,
            main_entity: cluster.main_entity,
            category: cluster.category,
            title: cluster.title,
            merged_context: cluster.merged_context ?? [],
            max_attention_score: null,
          })
        } catch {
          result.stages.writer = { status: 'error', articlesGenerated: 0, fieldsFilled: 0 }
          return null
        }
      }

      let enrichmentOutcome: { fields: Record<string, any>; itemsEnriched: number } | null = null
      let writerArticle: WriterArticle | null = null
      if (parallelOk) {
        ;[enrichmentOutcome, writerArticle] = await Promise.all([enrichmentTask(), writerTask()])
      } else {
        enrichmentOutcome = await enrichmentTask()
        writerArticle = await writerTask()
      }

      // Sequential binds — no concurrent mutation of `instance`.
      let enrichmentLinkCount = 0
      if (enrichmentOutcome) {
        const bindResult = await bindEnricherFields(instance, enrichmentOutcome.fields)
        enrichmentLinkCount = (enrichmentOutcome.fields.source_links as unknown[] | undefined)?.length ?? 0
        result.stages.enrichment = {
          status: 'success',
          itemsEnriched: enrichmentOutcome.itemsEnriched,
          fieldsRecovered: bindResult.filled,
        }
      }
      if (writerArticle) {
        const bindResult = await bindWriterFields(instance, {
          headline: writerArticle.title,
          body: writerArticle.variants.full,
          tags: [writerArticle.category],
          variants: writerArticle.variants,
        })
        result.stages.writer = {
          status: 'success',
          articlesGenerated: 1,
          fieldsFilled: bindResult.filled,
        }
      }

      // Step 5: Run Creator (if not skipped)
      if (!input.skipCreator) {
        // Creator field instructions not yet implemented — left pending.
        result.stages.creator = { status: 'pending', graphicsGenerated: 0, fieldsFilled: 0 }
      }

      // Step 6: Validate completeness + quality gate
      const validation = validateTemplateInstance(instance, pickResult.selectedTemplate)
      const state = getInstanceState(instance)

      const writerBody = writerArticle?.variants?.full ?? ''
      const qualityGate = evaluateQualityGate({
        wordCount: writerBody.trim() ? writerBody.trim().split(/\s+/).length : 0,
        hasHeadline: Boolean(writerArticle?.title),
        sourceCount:
          cluster.source_count ??
          (Array.isArray(cluster.merged_context) ? cluster.merged_context.length : 0),
        enrichmentLinks: enrichmentLinkCount,
        completeness: state.completeness,
      })
      result.qualityGate = qualityGate

      const requiredEnrichment = {
        spotify: Boolean(cluster.spotify_url),
        youtube: Boolean(cluster.youtube_url),
        genius: Boolean(cluster.genius_url),
        links: [cluster.spotify_url, cluster.youtube_url, cluster.genius_url, cluster.apple_music_url].filter(Boolean).length > 0,
        tags: Boolean(cluster.category) && Boolean(cluster.main_entity),
      }
      const enrichmentComplete = Object.values(requiredEnrichment).every(Boolean)

      result.instance = instance
      result.stages.binding = {
        status: validation.valid && enrichmentComplete && qualityGate.verdict === 'pass' ? 'complete' : 'partial',
        completeness: state.completeness,
        missingFields: [
          ...validation.missingFields,
          ...(!requiredEnrichment.spotify ? ['enrichment.spotify_url'] : []),
          ...(!requiredEnrichment.youtube ? ['enrichment.youtube_url'] : []),
          ...(!requiredEnrichment.genius ? ['enrichment.genius_url'] : []),
          ...(!requiredEnrichment.links ? ['enrichment.source_links'] : []),
          ...(!requiredEnrichment.tags ? ['enrichment.tags'] : []),
          ...(qualityGate.verdict !== 'pass' ? [`quality_gate.${qualityGate.verdict}`] : []),
        ],
      }

      // Step 7: Export to feed — only fully-valid, quality-passed stories.
      const ready = validation.valid && enrichmentComplete && qualityGate.verdict === 'pass'
      if (ready) {
        result.feedContent = exportToFeedPost(instance)
      }

      result.status = ready ? 'success' : 'partial'
      result.completedAt = new Date().toISOString()
      result.totalProcessingMs = Date.now() - startTime

      return result
    } catch {
      result.status = 'error'
      result.completedAt = new Date().toISOString()
      result.totalProcessingMs = Date.now() - startTime
      return result
    }
  }

  private errorResult(message: string, startTime: number, executionPlan: FactoryStageId[][]): FactoryV2Result {
    return {
      id: this.runId,
      clusterId: '',
      templateType: 'unknown',
      templateId: '',
      status: 'error',
      executionPlan,
      stages: {
        analysis: { status: 'error', reasoning: message, templateSelected: '' },
        enrichment: { status: 'skipped', itemsEnriched: 0, fieldsRecovered: 0 },
        writer: { status: 'skipped', articlesGenerated: 0, fieldsFilled: 0 },
        creator: { status: 'skipped', graphicsGenerated: 0, fieldsFilled: 0 },
        binding: { status: 'skipped', completeness: 0, missingFields: [] },
      },
      qualityGate: null,
      instance: null,
      feedContent: null,
      completedAt: new Date().toISOString(),
      totalProcessingMs: Date.now() - startTime,
    }
  }
}

export async function runFactoryV2(input: FactoryV2Input): Promise<FactoryV2Result> {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  const db = createAdminClient() ?? authClient
  const coordinator = new FactoryCoordinatorV2(db)
  return coordinator.orchestrate(input)
}
