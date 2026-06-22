import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { ScreenShare, SquarePen, TrashIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { DeviceCreateUpdateModal } from "./Devices";
import { useDeleteDevice, useUpdateDevice } from "./hooks";
import { type Device, type DeviceFormValues, deviceInputSchema } from "./types";

export const columns: ColumnDef<Device>[] = [
  {
    accessorKey: "id",
    meta: { title: "id" },
    header: "UUID",
  },
  {
    accessorKey: "name",
    meta: { title: "name" },
    header: "Device Name",
  },
  {
    accessorKey: "description",
    meta: { title: "description" },
    header: "Description",
  },
  {
    accessorKey: "type",
    meta: { title: "type" },
    header: "Device Type",
  },
  {
    accessorKey: "architecture",
    meta: { title: "architecture" },
    header: "Architecture Type",
  },
  {
    accessorKey: "cloud_init",
    meta: { title: "cloud_init" },
    header: "Cloud Init?",
  },
  {
    accessorKey: "cpus",
    meta: { title: "cpus" },
    header: "CPU Cores",
  },
  {
    accessorKey: "memory",
    meta: { title: "memory" },
    header: "Memory",
  },
  {
    accessorKey: "disk",
    meta: { title: "disk" },
    header: "Disk",
  },
  {
    accessorKey: "disk_controller",
    meta: { title: "disk_controller" },
    header: "Disk Controller",
  },
  {
    accessorKey: "display",
    meta: { title: "display" },
    header: "Display?",
  },
  {
    accessorKey: "vm_image_id",
    meta: { title: "vm_image_id" },
    header: "VM Image ID",
  },
  {
    accessorKey: "container_image_id",
    meta: { title: "container_image_id" },
    header: "Container Image ID",
  },
  {
    accessorKey: "dhcp",
    meta: { title: "dhcp" },
    header: "DHCP",
  },
  {
    accessorKey: "mac_address",
    meta: { title: "mac_address" },
    header: "MAC Address",
  },
  {
    accessorKey: "ipv4_manual",
    meta: { title: "ipv4_manual" },
    header: "IPV4 Manual?",
  },
  {
    accessorKey: "gateway",
    meta: { title: "gateway" },
    header: "Gateway",
  },
  {
    accessorKey: "dns_servers",
    meta: { title: "dns_servers" },
    header: "DNS Servers",
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const data = row.original;
      const vncUrl = `/devices/${data.id}`;

      const deleteDevice = useDeleteDevice();
      const handleRemove = () => {
        deleteDevice.mutate({ id: data.id });
      };

      const updateDevice = useUpdateDevice();
      const [open, setOpen] = useState(false);

      const form = useForm<DeviceFormValues>({
        resolver: zodResolver(deviceInputSchema),
        defaultValues: {
          name: data.name,
          description: data.description,
          type: data.type,
          architecture: data.architecture,
          cloud_init: data.cloud_init,
          cpus: data.cpus,
          memory: data.memory,
          disk: data.disk,
          disk_controller: data.disk_controller,
          display: data.display,
          vm_image_id: data.vm_image_id,
          container_image_id: data.container_image_id,
          dhcp: data.dhcp,
          mac_address: data.mac_address ?? undefined,
          ipv4_manual: data.ipv4_manual ?? undefined,
          gateway: data.gateway ?? undefined,
          dns_servers: data.dns_servers,
        },
      });

      const handleUpdate = (item: DeviceFormValues) => {
        updateDevice.mutate(
          { id: data.id, updateDevice: item },
          {
            onSuccess: () => {
              form.reset();
              setOpen(false);
            },
            onError: () => {
              setOpen(true);
            },
          },
        );
      };

      return (
        <div className="flex inline-flex">
          <div className="flex w-24 bg-blue-300/80 h-8 gap-1.5 px-2.5 py-1 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap">
            <ScreenShare />
            <a href={vncUrl} className="">
              Viewer
            </a>
          </div>
          <Button
            className=""
            onClick={() => setOpen(true)}
            disabled={updateDevice.isPending}
          >
            <SquarePen />
            {updateDevice.isPending ? "Updating..." : "Update"}
          </Button>
          <Button
            className=""
            onClick={handleRemove}
            disabled={deleteDevice.isPending}
            variant="destructive"
          >
            <TrashIcon />
            Delete
          </Button>

          {open && (
            <DeviceCreateUpdateModal
              form={form}
              open={open}
              setOpen={setOpen}
              handleCreate={handleUpdate}
              isUpdate={true}
            />
          )}
        </div>
      );
    },
  },
];
