import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { PlusIcon, SlashIcon } from "lucide-react";
import { useState } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
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
import { columns } from "./columns";
import { getDevices, useCreateDevice } from "./hooks";
import {
  type Device,
  DeviceArchitectureType,
  type DeviceFormValues,
  DeviceType,
  DiskControllerType,
  deviceInputSchema,
} from "./types";

export const DeviceCreateUpdateModal = ({
  form,
  handleCreate,
  open,
  setOpen,
  isUpdate,
}: {
  form: UseFormReturn<DeviceFormValues>;
  handleCreate: (values: DeviceFormValues) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  isUpdate?: boolean;
}) => {
  const onSubmit = (values: DeviceFormValues) => {
    console.log("onSubmit");
    handleCreate(values);
  };

  const isPending = form.formState.isSubmitting;
  const verbLabel = isUpdate ? "Update" : "Create";
  const description = isUpdate
    ? "Modify Device fields then press 'Update Device' below when you are finished"
    : "Configure a new Device then press 'Create Device' below when you are finished";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 rounded-2xl w-6xl lg:max-w-2xl overflow-hidden">
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
                    <FormLabel>Description *</FormLabel>
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
                            <FormLabel htmlFor={type}>{type}</FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
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
                        {Object.values(DeviceArchitectureType).map(
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
                          field.onChange(Number.isNaN(value) ? 4096 : value);
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
                          field.onChange(Number.isNaN(value) ? 20480 : value);
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
                        {Object.values(DiskControllerType).map((type, i) => (
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
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                name="image_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image ID</FormLabel>
                    <FormDescription>
                      TODO: If no ID is provided a default image may be used
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="e.g. 192.168.0.254"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dhcp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DHCP *</FormLabel>
                    <FormDescription>
                      Enable DHCP for automatic addressing, or disable it and
                      provide static network settings below.
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
                name="mac_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MAC Address</FormLabel>
                    <FormDescription>
                      Optionally set a specific MAC address instead of using an
                      automatic assignment.
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
          <Button type="submit" form="device-form" disabled={isPending}>
            {verbLabel} Device
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const DevicesContainer = () => {
  const {
    data: devices,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["devices"],
    queryFn: getDevices,
  });

  const createDevice = useCreateDevice();
  const [open, setOpen] = useState(false);

  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceInputSchema),
    defaultValues: {
      name: "",
      description: "",
      type: DeviceType.vm,
      architecture: DeviceArchitectureType.x86_64,
      cloud_init: false,
      cpus: 2,
      memory: 4096, // Megabytes
      disk: 20480, // Megabytes
      disk_controller: "virtio",
      display: false,
      image_id: "",
      dhcp: true,
      mac_address: undefined,
      ipv4_manual: undefined,
      gateway: undefined,
      dns_servers: [],
    },
  });

  const handleCreate = (item: DeviceFormValues) => {
    createDevice.mutate(item, {
      onSuccess: () => {
        form.reset();
        setOpen(false);
      },
      onError: () => {
        setOpen(true);
      },
    });
  };

  if (isPending) {
    return <DevicesLoading />;
  }

  if (isError) {
    console.error(error);
    return <DevicesError />;
  }

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
        className="self-end text-md bg-blue-800"
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

const DevicesLoading = () => {
  return <div>Devices loading...</div>;
};

const DevicesError = () => {
  return <div>An error occured while loading Devices!</div>;
};

interface DevicesListI {
  devices: Device[];
}

const DevicesList = ({ devices }: DevicesListI) => {
  const table = useReactTable({
    data: devices,
    columns: columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <table
        style={{ border: "1px solid black", width: "100%", textAlign: "left" }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup, index) => (
            <tr key={index}>
              {headerGroup.headers.map((header, index) => (
                <th
                  key={index}
                  style={{ borderBottom: "1px solid black", padding: "8px" }}
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
        <tbody>
          {table.getRowModel().rows.map((row, index) => (
            <tr key={index}>
              {row.getVisibleCells().map((cell, index) => (
                <td
                  key={index}
                  style={{ padding: "8px", borderBottom: "1px solid #eee" }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
