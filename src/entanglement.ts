import { SyncManager, SyncRegistry } from "@hadron/entanglement";
import { SyncOwner, PersistentSynchronizable } from "@hadron/entanglement/persistence";
import registerWhsModels from "@/entanglement_schemas/whs_models";
import { getCarthageApiUrl } from "@/fetcher";

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
  const registry = new SyncRegistry({base: PersistentSynchronizable});


  // Register WHS models schema
  registerWhsModels(registry);
  // It turns out we do not use SQL persistence layer, but we do want SyncOwner.
  registry.register(SyncOwner);

  // Create WebSocket URL by modifying the HTTP URL's protocol
  const wsUrl = new URL(apiUrl);
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
  wsUrl.pathname = wsUrl.pathname.replace(/\/$/, "") + "/entanglement";

  // Create SyncManager
  const manager = new SyncManager({
    url: wsUrl.toString(),
    registries: [registry],
  });

  return { manager, registry };
}
