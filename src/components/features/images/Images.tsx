import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  Row,
  useReactTable,
} from "@tanstack/react-table";
import { PlusIcon, SlashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
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
import { getImageColumns } from "./columns";
import {
  DeviceImage,
  type DeviceImageUploadFormValues,
  deviceImageUploadInputSchema,
} from "./types";
import { useEntangledList, useEntangledObject } from "entanglement-react";
import { VmImage } from "@/models";
import { SyncOwner } from "entanglement-core/persistence";

export const ImageUploadModal = ({
  form,
  handleCreate,
  open,
  pendingImage,
  setOpen,
}: {
  form: UseFormReturn<DeviceImageUploadFormValues>;
  handleCreate: (values: DeviceImageUploadFormValues) => void;
  open: boolean;
  pendingImage?: DeviceImage | null;
  setOpen: (open: boolean) => void;
  isUpdate?: boolean;
}) => {
  const onSubmit = (values: DeviceImageUploadFormValues) => {
    handleCreate(values);
  };

  const isPending = form.formState.isSubmitting;
  const selectedFile = form.watch("file");
  const isPendingUpload = Boolean(pendingImage);
  const pendingImageName = pendingImage?.name ?? "";
  const uploadLabel = isPendingUpload ? "Upload Pending Image" : "Upload Image";
  const filenameMismatch =
    pendingImage && selectedFile
      ? selectedFile.name !== pendingImage.name
      : false;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 rounded-2xl w-6xl lg:max-w-2xl overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b gap-1">
          <DialogTitle className="text-xl">{uploadLabel}</DialogTitle>
          <DialogDescription>
            {isPendingUpload
              ? `Upload the image file for ${pendingImageName}. The filename must match the pending image name.`
              : "Upload an virtual machine image"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, (e) => console.error(e))}
            id="image-form"
            className="px-6"
          >
            <div className="no-scrollbar -mx-6 px-6 py-4 max-h-[60vh] overflow-y-auto grid gap-6">
              <FormField
                control={form.control}
                name="file"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Upload File *</FormLabel>
                    <FormDescription>
                      {isPendingUpload
                        ? `Choose the file named ${pendingImageName}`
                        : "Provide any additional details here"}
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="file"
                        accept=".qcow2, .raw"
                        onChange={(e) => {
                          field.onChange(e.target.files?.[0]);
                        }}
                      />
                    </FormControl>
                    {filenameMismatch ? (
                      <p className="text-sm text-destructive">
                        Selected file must be named {pendingImageName}.
                      </p>
                    ) : null}
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
                      Provide any additional details here
                    </FormDescription>
                    <FormControl>
                      <Input type="text" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="version"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Version</FormLabel>
                    <FormDescription>
                      A given version name or number
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="e.g., v1.0.0"
                        {...field}
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
          <Button
            type="submit"
            form="image-form"
            disabled={isPending || filenameMismatch}
          >
            {uploadLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const VmImagesContainer = () => {
  const images = useEntangledList(VmImage);

  // const uploadImage = useUploadImage();
  const [open, setOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<DeviceImage | null>(null);

  const form = useForm<DeviceImageUploadFormValues>({
    resolver: zodResolver(deviceImageUploadInputSchema),
    defaultValues: {
      file: undefined,
      description: "",
      version: "",
    },
  });

  useEffect(() => {
    if (!open) {
      setPendingImage(null);
      form.reset({
        file: undefined,
        description: "",
        version: "",
      });
      return;
    }

    if (pendingImage) {
      form.reset({
        file: undefined,
        description: pendingImage.description,
        version: pendingImage.version,
      });
    }
  }, [form, open, pendingImage]);

  const handleCreate = async (item: DeviceImageUploadFormValues) => {
    // repack data as FormData so the browser auto sets the header to
    // Content-Type: multipart/form-data. the browser has to do it itself
    const formData = new FormData();
    formData.append("file", item.file);
    formData.append("description", item.description);
    formData.append("version", item.version);

    const owner = Array.from(SyncOwner.syncStorageMap.values())[0];
    const newVmImage = new VmImage();
    Object.assign(newVmImage, item, { _sync_owner: owner });

    try {
      const created = await newVmImage.syncCreate(syncManager);
      form.reset();
      setOpen(false);
      console.log("uploaded image:", created);
    } catch (e: unknown) {
      setOpen(true);
      console.log("error creating device:", e);
    }
  };

  const handleOpenNewUpload = () => {
    setPendingImage(null);
    setOpen(true);
  };

  const handleOpenPendingUpload = (image: DeviceImage) => {
    setPendingImage(image);
    setOpen(true);
  };

  return (
    <div className="flex flex-col">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/images">All Images</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <SlashIcon />
          </BreadcrumbSeparator>
        </BreadcrumbList>
      </Breadcrumb>

      <Button
        className="self-end text-base font-semibold bg-blue-800 mb-1 hover:bg-blue-700 transition-color"
        onClick={handleOpenNewUpload}
      >
        <PlusIcon />
        Upload Image
      </Button>

      <ImageUploadModal
        form={form}
        open={open}
        pendingImage={pendingImage}
        setOpen={setOpen}
        handleCreate={handleCreate}
      />
      <VmImagesList images={images} onUploadPending={handleOpenPendingUpload} />
    </div>
  );
};

interface DeviceImageRowProps {
  row: Row<VmImage>;
}

function VmImageRow({ row }: DeviceImageRowProps) {
  const image = useEntangledObject(row.original);

  return (
    <tr
      className="odd:bg-white even:bg-blue-50 transition-colors hover:bg-gray-200"
    >
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="px-4 py-3 truncate">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}

interface VmImagesListProps {
  images: readonly VmImage[];
  onUploadPending: (image: DeviceImage) => void;
}

const VmImagesList = ({ images, onUploadPending }: VmImagesListProps) => {
  const table = useReactTable({
    data: images as VmImage[],
    columns: getImageColumns({ onUploadPending }),
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded border border-gray-300">
      <table className="w-full">
        <thead className="bg-blue-200">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="border-b border-gray-200 px-4 py-3 text-left font-bold uppercase "
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
            <VmImageRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
};
