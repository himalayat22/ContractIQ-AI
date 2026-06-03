export function validateRequest(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const details = Object.entries(fieldErrors).map(([field, messages]) => ({
        field,
        messages: Array.isArray(messages) ? messages : [messages],
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details,
        },
        meta: {
          requestId: req.headers['x-request-id'] ?? req.id ?? null,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Express 5: req.query is read-only; store parsed query separately.
    if (source === 'query') {
      req.validatedQuery = result.data;
      return next();
    }

    req[source] = result.data;
    return next();
  };
}

export const validateBody = (schema) => validateRequest(schema, 'body');
export const validateQuery = (schema) => validateRequest(schema, 'query');
export const validateParams = (schema) => validateRequest(schema, 'params');
