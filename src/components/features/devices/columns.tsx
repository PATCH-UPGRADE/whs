import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useEntangledValue, useEntanglementManager } from "entanglement-react";
import { ArrowRight, SquarePen, TrashIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Device } from "@/models";
import { DeviceCreateUpdateModal } from "./Devices";
import {
  DEVICE_TYPE_TO_DISPLAY_TEXT,
  type DeviceFormValues,
  DeviceType,
  deviceInputSchema,
} from "./types";

export const columns: ColumnDef<Device>[] = [
  // {
  //   accessorKey: "id",
  //   meta: { title: "id" },
  //   header: "ID",
  // },
  {
    accessorKey: "name",
    meta: { title: "name" },
    header: "Name",
  },
  {
    accessorKey: "description",
    meta: { title: "description" },
    header: "Description",
  },
  {
    accessorKey: "type",
    meta: { title: "type" },
    header: "Type",
    cell: ({ row }) => {
      return DEVICE_TYPE_TO_DISPLAY_TEXT[row.original.type];
    },
  },
  // {
  //   accessorKey: "architecture",
  //   meta: { title: "architecture" },
  //   header: "Architecture Type",
  // },
  // {
  //   accessorKey: "cloud_init",
  //   meta: { title: "cloud_init" },
  //   header: "Cloud Init?",
  // },
  // {
  //   accessorKey: "cpus",
  //   meta: { title: "cpus" },
  //   header: "CPU Cores",
  // },
  // {
  //   accessorKey: "memory",
  //   meta: { title: "memory" },
  //   header: "Memory",
  // },
  // {
  //   accessorKey: "disk",
  //   meta: { title: "disk" },
  //   header: "Disk",
  // },
  // {
  //   accessorKey: "disk_controller",
  //   meta: { title: "disk_controller" },
  //   header: "Disk Controller",
  // },
  // {
  //   accessorKey: "display",
  //   meta: { title: "display" },
  //   header: "Display?",
  // },
  // {
  //   accessorKey: "vm_image_id",
  //   meta: { title: "vm_image_id" },
  //   header: "VM Image ID",
  // },
  // {
  //   accessorKey: "container_image_id",
  //   meta: { title: "container_image_id" },
  //   header: "Container Image ID",
  // },
  // {
  //   accessorKey: "dhcp",
  //   meta: { title: "dhcp" },
  //   header: "DHCP",
  // },
  // {
  //   accessorKey: "mac_address",
  //   meta: { title: "mac_address" },
  //   header: "MAC Address",
  // },
  // {
  //   accessorKey: "ipv4_manual",
  //   meta: { title: "ipv4_manual" },
  //   header: "IPV4 Manual?",
  // },
  // {
  //   accessorKey: "gateway",
  //   meta: { title: "gateway" },
  //   header: "Gateway",
  // },
  // {
  //   accessorKey: "dns_servers",
  //   meta: { title: "dns_servers" },
  //   header: "DNS Servers",
  // },
  {
    meta: { title: "pending" },
    header: "VM Image Status",
    cell: ({ row }) => {
      const image = useEntangledValue(row.original, (d) => d.vm_image);

      if (row.original.type !== DeviceType.vm) {
        return;
      }

      if (!image) {
        return <Badge variant={"red"}>Image field not set</Badge>;
      }

      if (image.pending) {
        return <Badge variant={"orange"}>Pending Upload</Badge>;
      }

      return <Badge variant={"green"}>Uploaded</Badge>;
    },
  },
  {
    accessorKey: "enabled_for_deployment",
    meta: { title: "enabled_for_deployment" },
    header: "Enabled",
    cell: ({ row }) => {
      if (!row.original.enabled_for_deployment) {
        return <Badge variant={"disabled"}>Disabled</Badge>;
      }

      return <Badge variant={"green"}>Enabled</Badge>;
    },
  },
  {
    id: "actions",
    enableHiding: false,
    header: "Actions",
    cell: ({ row }) => {
      const device = row.original;

      const navigate = useNavigate();
      const syncManager = useEntanglementManager();
      const image = useEntangledValue(
        device,
        (d) => d.vm_image ?? d.container_image,
      );

      const [editModalOpen, setEditModalOpen] = useState(false);
      const [deleteModalOpen, setDeleteModalOpen] = useState(false);

      const deviceForm = useForm<DeviceFormValues>({
        resolver: zodResolver(deviceInputSchema),
        defaultValues: {
          enabled_for_deployment: device.enabled_for_deployment,
          name: device.name,
          description: device.description ?? "",
          type: device.type,
          architecture: device.architecture ?? undefined,
          cloud_init: device.cloud_init,
          cpus: device.cpus,
          memory: device.memory,
          disk: device.disk,
          disk_controller: device.disk_controller ?? undefined,
          display: device.display,
          vm_image_id: device.vm_image_id,
          container_image_id: image?.name ?? device.container_image_id,
          dhcp: device.dhcp,
          mac_address: device.mac_address ?? undefined,
          ipv4_manual: device.ipv4_manual ?? undefined,
          gateway: device.gateway ?? undefined,
          dns_servers: device.dns_servers,
        },
      });

      const handleDelete = () => {
        device.syncDelete(syncManager);
      };

      const handleDeviceUpdate = (item: DeviceFormValues) => {
        Object.assign(device, item);

        try {
          device.syncUpdate(syncManager);
          deviceForm.reset();
          setEditModalOpen(false);
          console.log("updated device:", device);
        } catch (e: unknown) {
          setEditModalOpen(true);
          console.log("failed to update device:", e, device);
        }
      };

      return (
        <div className="flex gap-2">
          <Button
            className="default"
            onClick={() => {
              navigate({
                to: "/devices/$deviceId",
                params: { deviceId: device?.id ?? row.original.id },
              });
            }}
          >
            <ArrowRight data-icon="inline-start" />
            View
          </Button>

          <Button
            className="bg-neutral-300 text-black"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              setEditModalOpen(true);
            }}
          >
            <SquarePen data-icon="inline-start" />
            Update
          </Button>

          <Button
            className=""
            onClick={(e) => {
              e.stopPropagation();
              setDeleteModalOpen(true);
            }}
            variant="destructive"
          >
            <TrashIcon data-icon="inline-start" />
            Delete
          </Button>

          {editModalOpen && (
            <DeviceCreateUpdateModal
              form={deviceForm}
              open={editModalOpen}
              setOpen={setEditModalOpen}
              handleCreate={handleDeviceUpdate}
              isUpdate={true}
            />
          )}

          <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {device.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the device. This action cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive/30 text-destructive hover:bg-destructive/40"
                  onClick={handleDelete}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );
    },
  },
];
