import { z } from "zod";

export const DeviceArchitectureType = {
  x86_64: "x86_64",
  aarch64: "aarch64",
  native: "native",
} as const;

export const DeviceType = {
  vm: "vm",
  container: "container",
  bareMetal: "bareMetal",
} as const;

export const DiskControllerType = {
  virtio: "virtio",
  sata: "sata",
} as const;

export const DEVICE_TYPE_TO_DISPLAY_TEXT = {
  [DeviceType.vm]: "Virtual Machine",
  [DeviceType.container]: "Container",
  [DeviceType.bareMetal]: "Bare Metal",
};

export const DEVICE_ARCHITECTURE_TYPE_TO_DISPLAY_TEXT = {
  [DeviceArchitectureType.x86_64]: "x86_64",
  [DeviceArchitectureType.aarch64]: "aarch64",
  [DeviceArchitectureType.native]: "Native",
};

export const deviceInputSchema = z
  .object({
    name: z.string().min(3),
    description: z.string(),
    type: z.enum(DeviceType),
    architecture: z.enum(DeviceArchitectureType),
    cloud_init: z.boolean(),
    cpus: z.number(),
    memory: z.number(),
    disk: z.number(),
    disk_controller: z.enum(DiskControllerType),
    display: z.boolean(),
    vm_image_id: z.string().nullish(),
    container_image_id: z.string().nullish(),
    dhcp: z.boolean(),
    mac_address: z.string().optional(),
    ipv4_manual: z.string().optional(),
    gateway: z.string().optional(),
    dns_servers: z.array(z.string()),
  })
  .superRefine((device, ctx) => {
    if (
      device.type === DeviceType.container &&
      !device.container_image_id?.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["container_image_id"],
        message: "A container image is required.",
      });
    }
  });

export const deviceOutputSchema = z.object({
  id: z.string(),
  name: z.string().min(3),
  description: z.string(),
  type: z.enum(DeviceType),
  architecture: z.enum(DeviceArchitectureType),
  cloud_init: z.boolean(),
  cpus: z.number(),
  memory: z.number(),
  disk: z.number(),
  disk_controller: z.enum(DiskControllerType),
  display: z.boolean(),
  vm_image_id: z.string().nullish(),
  vm_image: z.object(Image).nullish(),
  container_image_id: z.string().nullish(),
  container_image: z.object(Image).nullish(),
  dhcp: z.boolean(),
  mac_address: z.string().optional(),
  ipv4_manual: z.string().optional(),
  gateway: z.string().optional(),
  dns_servers: z.array(z.string()),
});

export const devicesSchema = z.array(deviceInputSchema);

export const createDeviceSchema = z.object({});

export const updateDeviceSettingsSchema = z.object({});

export const typologyResponseSchema = z.object({});

export type DeviceFormValues = z.infer<typeof deviceInputSchema>;

export type Device = z.infer<typeof deviceOutputSchema>;
