import { SyncManager, SyncRegistry } from "entanglement-core";
import {
  PersistentSynchronizable,
  SyncOwner,
} from "entanglement-core/persistence.js";
import registerCarthageEntanglement from "@/entanglement_schemas/carthage_entanglement";
import registerWhsModels from "@/entanglement_schemas/whs_models";
import { getCarthageApiUrl } from "@/fetcher";
import { ContainerImage, Device, VmImage, WhsEntangledNetwork } from "@/models";

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
  // Register the carthage entanglement schema (carthage's DI/instrumentation
  // models plus WhsEntangledNetwork)
  registerCarthageEntanglement(registry);
  // Register the model classes so they can be constructed from WebSocket messages
  registry.register(SyncOwner);
  registry.register(Device);
  registry.register(VmImage);
  registry.register(ContainerImage);
  registry.register(WhsEntangledNetwork);

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
