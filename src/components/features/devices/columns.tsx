import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { SquarePen, TrashIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import type { Device } from "@/models";
import { DeviceCreateUpdateModal } from "./Devices";
import { useDeleteDevice, useUpdateDevice } from "./hooks";
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
      if (row.original.type !== DeviceType.vm) {
        return;
      }

      const image = row.original.vm_image;
      if (!image) {
        return (
          <span className="inline-flex rounded-full bg-red-300/30 px-2 py-1 text-sm font-medium text-red-900">
            Image field not set
          </span>
        );
      } else if (image.pending) {
        return (
          <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-sm font-medium text-amber-900">
            Pending Upload
          </span>
        );
      }

      return (
        <span className="inline-flex rounded-full bg-green-300/30 px-2 py-1 text-sm font-medium text-green-900">
          Uploaded
        </span>
      );
    },
  },
  {
    accessorKey: "enabled_for_deployment",
    meta: { title: "enabled_for_deployment" },
    header: "Enabled",
    cell: ({ row }) => {
      if (!row.original.enabled_for_deployment) {
        return (
          <span className="inline-flex rounded-full bg-red-300/30 px-2 py-1 text-sm font-medium text-red-900">
            Disabled
          </span>
        );
      }

      return (
        <span className="inline-flex rounded-full bg-green-300/30 px-2 py-1 text-sm font-medium text-green-900">
          Enabled
        </span>
      );
    },
  },
  {
    id: "actions",
    enableHiding: false,
    header: "Actions",
    cell: ({ row }) => {
      const data = row.original;

      const deleteDevice = useDeleteDevice();
      const updateDevice = useUpdateDevice();
      // const uploadImage = useUploadImage();

      const handleRemove = () => {
        deleteDevice.mutate({ id: data.id });
      };

      const handleDeviceUpdate = (item: DeviceFormValues) => {
        updateDevice.mutate(
          { id: data.id, updateDevice: item },
          {
            onSuccess: () => {
              deviceForm.reset();
              setEditModalOpen(false);
            },
            onError: () => {
              setEditModalOpen(true);
            },
          },
        );
      };

      // const handleUploadImage = (item: ImageUploadFormValues) => {
      //   // repack data as FormData so the browser auto sets the header to
      //   // Content-Type: multipart/form-data. the browser has to do it itself
      //   const formData = new FormData();
      //   formData.append("file", item.file);
      //   formData.append("description", item.description);
      //   formData.append("version", item.version);

      //   uploadImage.mutate(formData, {
      //     onSuccess: () => {
      //       setUploadImageModalOpen(false);
      //     },
      //     onError: () => {
      //       setUploadImageModalOpen(true);
      //     },
      //   });
      // };

      const [editModalOpen, setEditModalOpen] = useState(false);
      // const [pendingImage, _setPendingImage] = useState<null>(null);
      // const [uploadImageModalOpen, setUploadImageModalOpen] = useState(false);

      const deviceForm = useForm<DeviceFormValues>({
        resolver: zodResolver(deviceInputSchema),
        defaultValues: {
          enabled_for_deployment: data.enabled_for_deployment,
          name: data.name,
          description: data.description ?? "",
          type: data.type,
          architecture: data.architecture ?? undefined,
          cloud_init: data.cloud_init,
          cpus: data.cpus,
          memory: data.memory,
          disk: data.disk,
          disk_controller: data.disk_controller ?? undefined,
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

      // const uploadImageForm = useForm<ImageUploadFormValues>({
      //   resolver: zodResolver(imageUploadInputSchema),
      //   defaultValues: {
      //     file: undefined,
      //     description: "",
      //     version: "",
      //   },
      // });

      return (
        <div className="flex justify-between">
          <div className="flex">
            {/* {data.vm_image?.pending ||
            (data.container_image?.pending && (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadImageModalOpen(true);
                  }}
                >
                  Upload
                </Button>
                <ImageUploadModal
                  form={uploadImageForm}
                  open={uploadImageModalOpen}
                  pendingImage={pendingImage}
                  setOpen={setUploadImageModalOpen}
                  handleCreate={handleUploadImage}
                />
              </>
            ))
          } */}
            <Button
              className=""
              onClick={(e) => {
                e.stopPropagation();
                setEditModalOpen(true);
              }}
              disabled={updateDevice.isPending}
            >
              <SquarePen />
              {updateDevice.isPending ? "Updating..." : "Update"}
            </Button>
          </div>

          <Button
            className="self-end"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            disabled={deleteDevice.isPending}
            variant="destructive"
          >
            <TrashIcon />
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
        </div>
      );
    },
  },
];
