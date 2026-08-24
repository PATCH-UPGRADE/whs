import { SyncManager, SyncRegistry } from "entanglement-react";
import {
  PersistentSynchronizable,
  SyncOwner,
} from "entanglement-core/persistence";
import registerWhsModels from "@/entanglement_schemas/whs_models";
import { getCarthageApiUrl } from "@/fetcher";
import { ContainerImage, Device, VmImage } from "@/models";

/**
 * Create props for entanglement-react's EntanglementProvider.
 *
 * Sets up a SyncManager connecting to /api/v1/entanglement on the Carthage API,
 * configures a SyncRegistry with persistence and WHS models schema.
 *
 * @returns Promise<{ manager: SyncManager; registry: SyncRegistry }>
 */
export async function createEntanglementProps(): Promise<{
  manager: InstanceType<typeof SyncManager>;
  registry: InstanceType<typeof SyncRegistry>;
}> {
  const apiUrl = getCarthageApiUrl();

  // Create the registry and register schemas
  const registry = new SyncRegistry({ base: PersistentSynchronizable });

  // Register WHS models schema
  registerWhsModels(registry);
  // Register the model classes so they can be constructed from WebSocket messages
  registry.register(SyncOwner);
  registry.register(Device);
  registry.register(VmImage);
  registry.register(ContainerImage);

  // Create WebSocket URL by modifying the HTTP URL's protocol
  const wsUrl = new URL(apiUrl);
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
  wsUrl.pathname = `${wsUrl.pathname.replace(/\/$/, "")}/entanglement`;

  // Create SyncManager
  const manager = new SyncManager({
    url: wsUrl.toString(),
    registries: [registry],
  });

  return { manager, registry };
}
