import { z } from "zod";

export const topologySchema = z.object({});

export const topologiesSchema = z.array(topologySchema);

export const updateTopologySchema = z.object({});

export const typologyResponseSchema = z.object({});

export const topologyStatusResponseSchema = z.object({
  running: z.boolean(),
  successes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  ),
  failures: z.array(z.string()),
  dependency_failures: z.array(z.string()),
  ignored: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  ),
  orphans: z.array(z.string()),
});

export type TopologiesResponse = z.infer<typeof topologiesSchema>;
export type TypologyResponse = z.infer<typeof typologyResponseSchema>;

export type TopologyStatusResponseStatus = z.infer<
  typeof topologyStatusResponseSchema
>;
