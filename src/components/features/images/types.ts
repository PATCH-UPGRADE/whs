import { z } from "zod";

export enum ImageType {
  qcow2,
  raw,
  container,
}

export const deviceImageOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  type: z.string(),
  pending: z.boolean(),
});

export const deviceImageUploadInputSchema = z.object({
  file: z.instanceof(File),
  description: z.string(),
  version: z.string(),
});

export const deviceImageUploadResponseSchema = z.object({
  message: z.string(),
});

export type DeviceImage = z.infer<typeof deviceImageOutputSchema>;
export type DeviceImageUploadFormValues = z.infer<typeof deviceImageUploadInputSchema>;
export type UploadDeviceImageResponseSchema = z.infer<
  typeof deviceImageUploadResponseSchema
>;
