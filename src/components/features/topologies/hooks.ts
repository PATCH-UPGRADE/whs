import { carthageFetcher } from "@/fetcher";
import type { TopologyStatusResponseStatus } from "./types";

export const getDeploymentStatus = () =>
  carthageFetcher<TopologyStatusResponseStatus>(`/deployment-status`);

export const startDeploy = () =>
  carthageFetcher<null>(`/deploy`, {
    method: "POST",
    body: "",
  });

export const getCurrentTopology = () =>
  carthageFetcher<TopologyStatusResponseStatus>("/current_topology");

export const setCurrentTopology = (newName: string) =>
  carthageFetcher<null>("/current_topology", {
    method: "PUT",
    body: `{ "payload": ${newName} }`,
  });
