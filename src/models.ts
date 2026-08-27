/**
 * Entanglement models for WHS application.
 *
 * These class constructors extend PersistentSynchronizable. At runtime, entanglement's
 * Python backend registers each model's schema (fields and primary keys) during setup.
 * The JavaScript classes serve as:
 *   1. Type declarations for TypeScript
 *   2. Constructors instantiated by syncReceive() when backend messages arrive
 *   3. Event emitter sources (each class has addEventListener/removeEventListener from inheritance)
 *
 * Do NOT hardcode syncType or syncPrimaryKeys here - they're populated dynamically from
 * the schema registration on the Python side via registry._schemaItem().
 */

import {
  PersistentSynchronizable,
  relationship,
} from "entanglement-core/persistence.js";

// ============================================================================
// VmImage Model
// ============================================================================

export class VmImage extends PersistentSynchronizable {
  // Primary key (set by backend schema registration)
  id!: string;

  // Core fields (populated from syncReceive messages)
  name!: string;
  description?: string | null;
  version?: string | null;
  type?: string | null;
  pending?: boolean;

  // Relationship: all devices using this image (created by relationship() below)
  declare readonly devices: readonly VmImage[];
}

// ============================================================================
// ContainerImage Model
// ============================================================================

export class ContainerImage extends PersistentSynchronizable {
  id!: string;
  name!: string;
  description?: string | null;
  version?: string | null;

  declare readonly containers: readonly Device[];
}

// ============================================================================
// Device Model
// ============================================================================

export class Device extends PersistentSynchronizable {
  // Primary key
  id!: string;

  // Image foreign keys (resolves via relationship() to actual image objects)
  vm_image_id: string | null = null;
  container_image_id: string | null = null;

  // Core fields
  name!: string;
  type!: "vm" | "container" | "bareMetal";
  cloud_init!: boolean;
  dhcp!: boolean;

  // Optional/common fields
  description?: string | null;
  architecture: ("x86_64" | "aarch64" | "native") | null = null;

  // VM-specific fields (undefined for container/bareMetal)
  cpus?: number;
  memory?: number;
  disk?: number;
  disk_controller: ("virtio" | "sata") | null = null;
  display?: boolean;

  // Network configuration
  mac_address: string | null = null;
  ipv4_manual: string | null = null;
  gateway: string | null = null;
  dns_servers: string[] = [];

  // Relationships created by relationship() below
  declare vm_image: VmImage | undefined;
  declare container_image: ContainerImage | undefined;
}

// ============================================================================
// Relationship Setup
// ============================================================================

/**
 * Wire up bidirectional relationships between Device and Image models.
 *
 * Each call to relationship():
 *   - Adds a getter on Local that resolves foreign_key → remote object via syncStorageMap
 *   - Adds a getter on Remote that returns all Locals referencing it
 *   - Listens for create/forward/delete events to update the cache
 *
 * These must be called after class definitions but before (or during) synchronization.
 */

// Device -> VmImage: many-to-one (many devices reference one vm_image via vm_image_id)
relationship(VmImage, Device, {
  keys: ["vm_image_id"],
  local_prop: "vm_image", // On Device: device.vm_image returns the image
  remote_prop: "devices", // On VmImage: vmImage.devices returns Set of devices
  use_list: true, // One-to-many (one image used by many devices)
  debug: false,
});

// Device -> ContainerImage: many-to-one (many devices reference one container_image via container_image_id)
relationship(ContainerImage, Device, {
  keys: ["container_image_id"],
  local_prop: "container_image",
  remote_prop: "containers",
  use_list: true, // One image referenced by many containers
  debug: false,
});

// ============================================================================
// WhsEntangledNetwork Model
// ============================================================================

/**
 * A WHS network as synchronized from the carthage entanglement registry.
 *
 * Produced server-side by the carthage entanglement instrumentation whenever
 * a WhsNetworkModel is instantiated by a layout (see
 * layout/python/dynamic_models.py).  Belongs to the carthage.entanglement
 * schema rather than whs_models.
 */
export class WhsEntangledNetwork extends PersistentSynchronizable {
  // Primary key (set by backend schema registration)
  name!: string;

  // Core fields (populated from syncReceive messages)
  // The network and netmask in CIDR notation
  network!: string;
  // id of the injector that produced the WhsNetworkModel
  injector_id!: number;
}
