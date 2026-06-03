import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../../../middleware/validateRequest.js';

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const createContractSchema = z.object({
  title: z.string().min(1).max(500),
  counterparty: z.string().min(1).max(300),
  contractType: z.enum(['nda', 'msa', 'sow', 'employment', 'vendor', 'other']),
  effectiveDate: z
    .union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000Z`;
      return value;
    }),
  expirationDate: z
    .union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000Z`;
      return value;
    }),
  tags: z.array(z.string().min(1).max(50)).max(20).optional().default([]),
  tenantId: z.string().regex(objectIdRegex, 'tenantId must be a valid ObjectId'),
  createdBy: z.string().regex(objectIdRegex, 'createdBy must be a valid ObjectId'),
});

export const getContractParamsSchema = z.object({
  id: z.string().regex(objectIdRegex, 'id must be a valid ObjectId'),
});

export const listContractsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['uploading', 'processing', 'analyzed', 'failed']).optional(),
  contractType: z.enum(['nda', 'msa', 'sow', 'employment', 'vendor', 'other']).optional(),
  q: z.string().trim().optional(),
});

export const validateCreateContract = validateBody(createContractSchema);
export const validateGetContractParams = validateParams(getContractParamsSchema);
export const validateListContractsQuery = validateQuery(listContractsQuerySchema);
