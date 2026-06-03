import mongoose from 'mongoose';
import { getGeminiClient } from '../../../infrastructure/gemini/client.js';
import { AppError } from '../../../utils/AppError.js';
import { withRetry } from '../../../utils/withRetry.js';
import { withTimeout } from '../../../utils/withTimeout.js';
import { getConfig } from '../../../config/env.js';
import {
  CONTRACT_ANALYSIS_JSON_SCHEMA,
  contractAnalysisResponseSchema,
} from '../schemas/contractAnalysis.schema.js';

const SYSTEM_INSTRUCTION = `You are ContractIQ AI, a legal contract analysis assistant.
Analyze the provided contract text and return ONLY valid JSON matching the required schema.
Produce:
1) An executive summary.
2) Risk score (0-100), risk level, and weighted risk factors with explanations.
3) Extracted clauses with clauseType, title, verbatim or concise text, risk level, and orderIndex starting at 1.
4) Key obligations per party (who must do what, deadlines if stated, severity).
5) Key dates (renewal, termination notice, payment due, etc.) with ISO-8601 dates.
Do not invent clauses not supported by the text. If information is missing, use lower severity and note uncertainty in riskNote.`;

function truncateContractText(text, maxChars) {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }

  return {
    text: `${text.slice(0, maxChars)}\n\n[TRUNCATED: analysis based on first ${maxChars} characters only]`,
    truncated: true,
  };
}

function extractTokenCount(response) {
  const usage = response?.usageMetadata ?? response?.usage;
  if (!usage) return 0;

  if (usage.totalTokenCount != null) {
    return usage.totalTokenCount;
  }

  return (usage.promptTokenCount ?? 0) + (usage.candidatesTokenCount ?? 0);
}

function mapGeminiError(error) {
  if (error instanceof AppError) {
    return error;
  }

  const message = error instanceof Error ? error.message : 'Gemini request failed';

  return new AppError(message, {
    statusCode: 503,
    code: 'AI_SERVICE_UNAVAILABLE',
  });
}

export class GeminiAnalysisProvider {
  constructor(config = getConfig()) {
    this.config = config;
  }

  async analyze({ tenantId, contractId, contractText }) {
    const startedAt = Date.now();
    const { text: normalizedText, truncated } = truncateContractText(
      contractText.trim(),
      this.config.geminiMaxContractChars,
    );

    if (!normalizedText) {
      throw new AppError('contractText is required for analysis', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    let rawResponse;

    try {
      rawResponse = await withRetry(
        () =>
          withTimeout(
            this.invokeGemini(normalizedText, truncated),
            this.config.geminiTimeoutMs,
            `Gemini analysis timed out after ${this.config.geminiTimeoutMs}ms`,
          ),
        {
          maxRetries: this.config.geminiMaxRetries,
          baseDelayMs: this.config.geminiRetryBaseDelayMs,
        },
      );
    } catch (error) {
      throw mapGeminiError(error);
    }

    const parsed = this.parseStructuredResponse(rawResponse.text);
    const tokensUsed = extractTokenCount(rawResponse);
    const processingTimeMs = Date.now() - startedAt;

    const clauses = parsed.clauses.map((clause, index) => {
      const id = new mongoose.Types.ObjectId();
      const text = clause.text;
      const baseOffset = index * 400;

      return {
        _id: id,
        tenantId,
        contractId,
        clauseType: clause.clauseType,
        title: clause.title,
        text,
        riskLevel: clause.riskLevel,
        riskNote: clause.riskNote ?? null,
        playbookDeviation: clause.riskLevel === 'high',
        pageNumber: clause.pageNumber ?? null,
        orderIndex: clause.orderIndex,
        startOffset: baseOffset,
        endOffset: baseOffset + text.length,
      };
    });

    const clauseByOrderIndex = new Map(clauses.map((c) => [c.orderIndex, c]));

    const keyDates = parsed.keyDates.map((kd) => {
      const sourceClause = kd.sourceClauseOrderIndex
        ? clauseByOrderIndex.get(kd.sourceClauseOrderIndex)
        : null;

      return {
        label: kd.label,
        date: new Date(kd.date),
        sourceClauseId: sourceClause?._id ?? undefined,
      };
    });

    const keyObligations = parsed.keyObligations.map((item) => {
      const linkedClause = item.clauseType
        ? clauses.find((c) => c.clauseType === item.clauseType)
        : null;

      return {
        party: item.party,
        obligation: item.obligation,
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        severity: item.severity,
        clauseType: item.clauseType ?? null,
        sourceClauseId: linkedClause?._id ?? undefined,
      };
    });

    return {
      summary: parsed.summary,
      riskScore: parsed.riskScore,
      riskLevel: parsed.riskLevel,
      riskFactors: parsed.riskFactors,
      keyDates,
      keyObligations,
      clauses,
      modelUsed: this.config.geminiModel,
      tokensUsed,
      processingTimeMs,
      truncated,
    };
  }

  async invokeGemini(contractText, truncated) {
    const client = getGeminiClient();
    const userPrompt = [
      'Analyze the following contract text.',
      truncated ? 'Note: input was truncated to fit model limits.' : '',
      '',
      '--- CONTRACT TEXT ---',
      contractText,
      '--- END CONTRACT TEXT ---',
    ]
      .filter(Boolean)
      .join('\n');

    return client.models.generateContent({
      model: this.config.geminiModel,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseJsonSchema: CONTRACT_ANALYSIS_JSON_SCHEMA,
      },
    });
  }

  parseStructuredResponse(text) {
    if (!text || typeof text !== 'string') {
      throw new AppError('Gemini returned an empty response', {
        statusCode: 503,
        code: 'AI_INVALID_RESPONSE',
      });
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AppError('Gemini returned invalid JSON', {
        statusCode: 503,
        code: 'AI_INVALID_RESPONSE',
      });
    }

    const result = contractAnalysisResponseSchema.safeParse(json);

    if (!result.success) {
      throw new AppError('Gemini response failed schema validation', {
        statusCode: 503,
        code: 'AI_INVALID_RESPONSE',
        details: result.error.flatten().fieldErrors,
      });
    }

    return result.data;
  }
}

export default GeminiAnalysisProvider;
