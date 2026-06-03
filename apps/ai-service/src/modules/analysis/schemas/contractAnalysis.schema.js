import { z } from 'zod';

/** JSON Schema passed to Gemini `responseJsonSchema` for structured output. */
export const CONTRACT_ANALYSIS_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: [
    'summary',
    'riskScore',
    'riskLevel',
    'riskFactors',
    'clauses',
    'keyObligations',
    'keyDates',
  ],
  additionalProperties: false,
  properties: {
    summary: {
      type: 'string',
      description: 'Executive contract summary (3-6 sentences).',
    },
    riskScore: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      description: 'Overall risk score from 0 (low) to 100 (high).',
    },
    riskLevel: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'critical'],
    },
    riskFactors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['factor', 'weight', 'score', 'explanation'],
        additionalProperties: false,
        properties: {
          factor: { type: 'string' },
          weight: { type: 'number', minimum: 0, maximum: 1 },
          score: { type: 'integer', minimum: 0, maximum: 100 },
          explanation: { type: 'string' },
        },
      },
    },
    keyDates: {
      type: 'array',
      items: {
        type: 'object',
        required: ['label', 'date'],
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          date: { type: 'string', description: 'ISO-8601 date string.' },
          sourceClauseOrderIndex: {
            type: 'integer',
            minimum: 1,
            description: 'orderIndex of the related extracted clause, if any.',
          },
        },
      },
    },
    keyObligations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['party', 'obligation', 'severity'],
        additionalProperties: false,
        properties: {
          party: { type: 'string', description: 'Party name or role (e.g. Vendor, Client).' },
          obligation: { type: 'string' },
          dueDate: { type: 'string', description: 'ISO-8601 date if applicable.' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          clauseType: { type: 'string' },
        },
      },
    },
    clauses: {
      type: 'array',
      items: {
        type: 'object',
        required: ['clauseType', 'title', 'text', 'riskLevel', 'orderIndex'],
        additionalProperties: false,
        properties: {
          clauseType: { type: 'string' },
          title: { type: 'string' },
          text: { type: 'string' },
          riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
          riskNote: { type: 'string' },
          pageNumber: { type: 'integer', minimum: 1 },
          orderIndex: { type: 'integer', minimum: 1 },
        },
      },
    },
  },
};

const riskFactorSchema = z.object({
  factor: z.string().min(1),
  weight: z.number().min(0).max(1),
  score: z.number().int().min(0).max(100),
  explanation: z.string().min(1),
});

const keyDateSchema = z.object({
  label: z.string().min(1),
  date: z.string().min(1),
  sourceClauseOrderIndex: z.number().int().min(1).optional(),
});

const keyObligationSchema = z.object({
  party: z.string().min(1),
  obligation: z.string().min(1),
  dueDate: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']),
  clauseType: z.string().optional(),
});

const clauseSchema = z.object({
  clauseType: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
  riskLevel: z.enum(['low', 'medium', 'high']),
  riskNote: z.string().optional(),
  pageNumber: z.number().int().min(1).optional(),
  orderIndex: z.number().int().min(1),
});

export const contractAnalysisResponseSchema = z.object({
  summary: z.string().min(1),
  riskScore: z.number().int().min(0).max(100),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  riskFactors: z.array(riskFactorSchema).min(1),
  keyDates: z.array(keyDateSchema),
  keyObligations: z.array(keyObligationSchema),
  clauses: z.array(clauseSchema).min(1),
});
