import { z } from 'zod';

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const contractIdParamsSchema = z.object({
  contractId: z.string().regex(objectIdRegex, 'contractId must be a valid ObjectId'),
});

export const clauseIdParamsSchema = contractIdParamsSchema.extend({
  clauseId: z.string().regex(objectIdRegex, 'clauseId must be a valid ObjectId'),
});

export const listClausesQuerySchema = z.object({
  clauseType: z.string().min(1).optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.enum(['orderIndex']).default('orderIndex'),
});

export const runAnalysisBodySchema = z
  .object({
    tenantId: z.string().regex(objectIdRegex, 'tenantId must be a valid ObjectId'),
    contractId: z.string().regex(objectIdRegex, 'contractId must be a valid ObjectId'),
    versionId: z.string().regex(objectIdRegex, 'versionId must be a valid ObjectId'),
    correlationId: z.string().min(1).max(128).optional(),
    contractText: z.string().min(100).max(500_000).optional(),
    extractedText: z.string().min(100).max(500_000).optional(),
  })
  .refine((data) => Boolean(data.contractText ?? data.extractedText), {
    message: 'contractText or extractedText is required (min 100 characters)',
    path: ['contractText'],
  })
  .transform((data) => ({
    tenantId: data.tenantId,
    contractId: data.contractId,
    versionId: data.versionId,
    correlationId: data.correlationId,
    contractText: data.contractText ?? data.extractedText,
  }));
