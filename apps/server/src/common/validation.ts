import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException(result.error.issues.map(issue => `${issue.path.join('.') || 'Input'}: ${issue.message}`).join(' '));
  return result.data;
}
