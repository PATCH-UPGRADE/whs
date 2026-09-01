import { zodResolver } from "@hookform/resolvers/zod";
import {
  flexRender,
  getCoreRowModel,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import { SyncOwner } from "entanglement-core/persistence";
import {
  useEntangledList,
  useEntangledObject,
  useEntangledValue,
  useEntanglementManager,
} from "entanglement-react";
import { PlusIcon, SlashIcon } from "lucide-react";
import { useState } from "react";
import { type UseFormReturn, useForm, useWatch } from "react-hook-form";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Device, VmImage } from "@/models";
import { columns } from "./columns";
import {
  DEVICE_ARCHITECTURE_TYPE_TO_DISPLAY_TEXT,
  DEVICE_TYPE_TO_DISPLAY_TEXT,
  DeviceArchitectureType,
  type DeviceFormValues,
  DeviceType,
  DiskControllerType,
  deviceInputSchema,
} from "./types";

const allDeviceArchitectureTypes = Object.values(DeviceArchitectureType);

interface DeviceCreateUpdateModalProps {
  form: UseFormReturn<DeviceFormValues>;
  handleCreate: (values: DeviceFormValues) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  isUpdate?: boolean;
}

export const DeviceCreateUpdateModal = ({
  form,
  handleCreate,
  open,
  setOpen,
  isUpdate,
}: DeviceCreateUpdateModalProps) => {
  const images = useEntangledList(VmImage);

  const onSubmit = (values: DeviceFormValues) => {
    handleCreate(values);
  };

  const isFormPending = form.formState.isSubmitting;
  const verbLabel = isUpdate ? "Update" : "Create";
  const description = isUpdate
    ? "Modify Device fields then press 'Update Device' below when you are finished"
    : "Configure a new Device then press 'Create Device' below when you are finished";

  const selectedDeviceType = useWatch({ control: form.control, name: "type" });

  // deviceArchitecture won't be shown for bareMetal
  const deviceArchitectureTypeOptions =
    selectedDeviceType === DeviceType.container
      ? allDeviceArchitectureTypes
      : allDeviceArchitectureTypes.slice(0, -1);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="p-0 rounded-2xl w-6xl lg:max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader className="px-6 py-4 border-b gap-1">
          <DialogTitle className="text-xl">{verbLabel} Device</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, (e) => console.error(e))}
            id="device-form"
            className="px-6"
          >
            <div className="no-scrollbar -mx-6 px-6 py-4 max-h-[60vh] overflow-y-auto grid gap-6">
              <FormField
                control={form.control}
                name="enabled_for_deployment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enabled</FormLabel>
                    <FormDescription>
                      Specify whether the device should be deployed.
                    </FormDescription>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormDescription>
                      Enter the device DNS hostname without the domain suffix.
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="e.g., hrmonitor-01"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormDescription>
                      Describe the device role or modality.
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="e.g., Heart rate monitor"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device Type *</FormLabel>
                    <FormDescription>
                      Select whether this OT asset is modeled as a virtual
                      machine or a container.
                    </FormDescription>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(val: string) => {
                          field.onChange(val);
                        }}
                        value={field.value}
                      >
                        {Object.values(DeviceType).map((type, i) => (
                          <FormItem
                            key={i}
                            className="flex gap-x-2 hover:border-primary/50 transition-colors"
                          >
                            <FormControl>
                              <RadioGroupItem
                                value={type}
                                className="rounded-lg border-2 border-primary hover:border-primary/50"
                              />
                            </FormControl>
                            <FormLabel htmlFor={type}>
                              {DEVICE_TYPE_TO_DISPLAY_TEXT[type]}
                            </FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedDeviceType === DeviceType.vm && (
                <FormField
                  control={form.control}
                  name="vm_image_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image ID</FormLabel>

                      <FormDescription>
                        Type to begin searching for a uploaded VM image (by
                        filename)
                      </FormDescription>

                      <FormControl>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select Image" />
                          </SelectTrigger>

                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Select Image</SelectLabel>

                              {images?.map(({ id, name, pending }, index) => (
                                <SelectItem value={id} key={index}>
                                  {pending ? `${name} (pending)` : name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {selectedDeviceType === DeviceType.container && (
                <FormField
                  control={form.control}
                  name="container_image_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image *</FormLabel>
                      <FormDescription>
                        Type an image reference like "nginx:latest" or
                        "ghcr.io/my/cool/image:123"
                      </FormDescription>
                      <FormControl>
                        <Input
                          type="text"
                          list="image-options"
                          placeholder="e.g., nginx:latest"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {selectedDeviceType !== DeviceType.bareMetal && (
                <FormField
                  control={form.control}
                  name="architecture"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Architecture Type *</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(val: string) => {
                            field.onChange(val);
                          }}
                          value={field.value}
                        >
                          {deviceArchitectureTypeOptions.map((type, i) => (
                            <FormItem
                              key={i}
                              className="flex gap-x-2 hover:border-primary/50 transition-colors"
                            >
                              <FormControl>
                                <RadioGroupItem
                                  value={type}
                                  className="rounded-lg border-2 border-primary hover:border-primary/50"
                                />
                              </FormControl>
                              <FormLabel htmlFor={type}>
                                {DEVICE_ARCHITECTURE_TYPE_TO_DISPLAY_TEXT[type]}
                              </FormLabel>
                            </FormItem>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {selectedDeviceType === DeviceType.vm && (
                <>
                  <FormField
                    control={form.control}
                    name="display"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Require Display *</FormLabel>
                        <FormDescription>
                          Specify whether the device needs a graphical display.
                        </FormDescription>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cloud_init"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cloud Init *</FormLabel>
                        <FormDescription>
                          Enable or disable cloud-init customization for this
                          device.
                        </FormDescription>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cpus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPU Cores *</FormLabel>
                        <FormDescription>
                          Set the number of virtual CPU cores assigned to this
                          device.
                        </FormDescription>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="2"
                            {...field}
                            onChange={(e) => {
                              const value = parseInt(e.target.value, 10);
                              field.onChange(Number.isNaN(value) ? 2 : value);
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Recommended Minimum: 2 CPU Cores
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="memory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Memory *</FormLabel>
                        <FormDescription>
                          Set the memory allocation for the device in MB.
                        </FormDescription>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="4096"
                            {...field}
                            onChange={(e) => {
                              const value = parseInt(e.target.value, 10);
                              field.onChange(
                                Number.isNaN(value) ? 4096 : value,
                              );
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Recommended Minimum: 4096 MBs
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="disk"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Disk *</FormLabel>
                        <FormDescription>
                          Set the device disk size in MB.
                        </FormDescription>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="20480"
                            {...field}
                            onChange={(e) => {
                              const value = parseInt(e.target.value, 10);
                              field.onChange(
                                Number.isNaN(value) ? 20480 : value,
                              );
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Recommended Minimum: 20480 MBs (20 GBs)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="disk_controller"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Disk Controller *</FormLabel>
                        <FormDescription>
                          Select the virtual disk controller presented to the
                          device.
                        </FormDescription>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(val: string) => {
                              field.onChange(val);
                            }}
                            value={field.value}
                          >
                            {Object.values(DiskControllerType).map(
                              (type, i) => (
                                <FormItem
                                  key={i}
                                  className="flex gap-x-2 hover:border-primary/50 transition-colors"
                                >
                                  <FormControl>
                                    <RadioGroupItem
                                      value={type}
                                      className="rounded-lg border-2 border-primary hover:border-primary/50"
                                    />
                                  </FormControl>
                                  <FormLabel htmlFor={type}>{type}</FormLabel>
                                </FormItem>
                              ),
                            )}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* <FormField
                control={form.control}
                name="dhcp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DHCP *</FormLabel>
                    <FormDescription>
                      Enable DHCP for automatic addressing, or disable it
                      and provide static network settings below.
                    </FormDescription>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}

              <FormField
                control={form.control}
                name="mac_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MAC Address</FormLabel>
                    <FormDescription>
                      Required for BARE METAL devices. Set a specific MAC
                      address instead of using an automatic assignment.
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="e.g. 00:1A:2B:3C:4D:5E"
                        {...field}
                        onChange={(e) => {
                          field.onChange(
                            e.target.value !== "" ? e.target.value : undefined,
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ipv4_manual"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ipv4</FormLabel>
                    <FormDescription>
                      Enter a static IPv4 address when DHCP is disabled.
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="e.g. 192.168.0.254"
                        {...field}
                        onChange={(e) => {
                          field.onChange(
                            e.target.value !== "" ? e.target.value : undefined,
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gateway"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Gateway</FormLabel>
                    <FormDescription>
                      Enter the default gateway for a statically addressed
                      device.
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="e.g. 192.168.0.1"
                        {...field}
                        onChange={(e) => {
                          field.onChange(
                            e.target.value !== "" ? e.target.value : undefined,
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dns_servers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNS Server(s)</FormLabel>
                    <FormDescription>
                      Set DNS servers manually as a comma-delimited list of IP
                      addresses
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="e.g. 192.168.0.2,192.168.0.3, etc"
                        {...field}
                        onChange={(e) => {
                          field.onChange(
                            e.target.value.replace(/\//g, "").split(","),
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>

        <DialogFooter className="px-6 py-4 bg-muted border-t justify-between!">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" form="device-form" disabled={isFormPending}>
            {verbLabel} Device
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const DevicesContainer = () => {
  const syncManager = useEntanglementManager();
  const devices = useEntangledList(Device);

  const [open, setOpen] = useState(false);

  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceInputSchema),
    defaultValues: {
      enabled_for_deployment: true,
      name: "",
      description: "",
      type: DeviceType.vm,
      architecture: DeviceArchitectureType.x86_64,
      cloud_init: false,
      cpus: 2,
      memory: 4096, // Megabytes
      disk: 20480, // Megabytes
      disk_controller: "virtio",
      display: true,
      vm_image_id: null,
      container_image_id: null,
      dhcp: true,
      mac_address: undefined,
      ipv4_manual: undefined,
      gateway: undefined,
      dns_servers: [],
    },
  });

  const handleCreate = async (item: DeviceFormValues) => {
    // handle edge case where user sets container to native then flips back to a VM
    if (item.architecture === "native" && item.type === "vm") {
      item.architecture = "x86_64";
    }

    const owner = Array.from(SyncOwner.syncStorageMap.values())[0];
    const newDevice = new Device();
    Object.assign(newDevice, item, { _sync_owner: owner });

    try {
      const _created = await newDevice.syncCreate(syncManager);
      form.reset();
      setOpen(false);
    } catch (e: unknown) {
      setOpen(true);
      console.error("error creating new device:", e.message);
    }
  };

  return (
    <div className="flex flex-col">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/devices">All Devices</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <SlashIcon />
          </BreadcrumbSeparator>
        </BreadcrumbList>
      </Breadcrumb>

      <Button
        className="self-end text-base font-semibold bg-blue-800 mb-1 hover:bg-blue-700 transition-color"
        onClick={() => setOpen(true)}
      >
        <PlusIcon />
        Add Device
      </Button>

      <DeviceCreateUpdateModal
        form={form}
        open={open}
        setOpen={setOpen}
        handleCreate={handleCreate}
      />
      <DevicesList devices={devices} />
    </div>
  );
};

interface DeviceRowProps {
  row: Row<Device>;
}

function DeviceRow({ row }: DeviceRowProps) {
  const device = useEntangledObject(row.original);
  const _image = useEntangledValue(
    device,
    (d) => d.vm_image ?? d.container_image,
  );

  return (
    <tr className="odd:bg-white even:bg-blue-50">
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="px-4 py-3 truncate">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}

interface DevicesListProps {
  devices: readonly Device[];
}

const DevicesList = ({ devices }: DevicesListProps) => {
  const table = useReactTable({
    data: devices as Device[], // useReactTable doesn't support readonly type
    columns: columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded border border-gray-300">
      <table className="w-full">
        <thead className="bg-blue-200">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="border-b border-gray-200 px-4 py-3 text-left font-bold uppercase"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="">
          {table.getRowModel().rows.map((row) => (
            <DeviceRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
};
