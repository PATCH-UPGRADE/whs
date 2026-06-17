import { z } from "zod";

export const importModelsInputSchema = z.object({
  file: z.instanceof(File),
});

export const importModelsResponseSchema = z.object({
  message: z.string(),
});

export type ImportModelsFormValues = z.infer<typeof importModelsInputSchema>;
export type ImportModelsResponse = z.infer<typeof importModelsResponseSchema>;
