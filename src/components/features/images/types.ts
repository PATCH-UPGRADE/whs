import { z } from "zod";

export enum ImageType {
  qcow2,
  raw,
  container,
}

export const imageOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  type: z.string(),
  pending: z.boolean(),
});

export const imageUploadInputSchema = z.object({
  file: z.instanceof(File),
  description: z.string(),
  version: z.string(),
});

export const imageUploadResponseSchema = z.object({
  message: z.string(),
});

export type Image = z.infer<typeof imageOutputSchema>;
export type ImageUploadFormValues = z.infer<typeof imageUploadInputSchema>;
export type UploadImageResponseSchema = z.infer<
  typeof imageUploadResponseSchema
>;
