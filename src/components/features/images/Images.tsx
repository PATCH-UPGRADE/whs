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
import { columns } from "./columns";
import { getImages, useUploadImage } from "./hooks";
import {
  type Image,
  type ImageUploadFormValues,
  imageUploadInputSchema,
} from "./types";

export const VmImageUploadModal = ({
  form,
  handleCreate,
  open,
  setOpen,
}: {
  form: UseFormReturn<ImageUploadFormValues>;
  handleCreate: (values: ImageUploadFormValues) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  isUpdate?: boolean;
}) => {
  const onSubmit = (values: ImageUploadFormValues) => {
    handleCreate(values);
  };

  const isPending = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 rounded-2xl w-6xl lg:max-w-2xl overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b gap-1">
          <DialogTitle className="text-xl">Upload Image</DialogTitle>
          <DialogDescription>Upload an virtual machine image</DialogDescription>
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
                      Provide any additional details here
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
          <Button type="submit" form="image-form" disabled={isPending}>
            Upload Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ImagesContainer = () => {
  const {
    data: images,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["images"],
    queryFn: getImages,
  });

  const uploadImage = useUploadImage();
  const [open, setOpen] = useState(false);

  const form = useForm<ImageUploadFormValues>({
    resolver: zodResolver(imageUploadInputSchema),
    defaultValues: {
      file: undefined,
      description: "",
      version: "",
    },
  });

  const handleCreate = (item: ImageUploadFormValues) => {
    // repack data as FormData so the browser auto sets the header to
    // Content-Type: multipart/form-data. the browser has to do it itself
    const formData = new FormData();
    formData.append("file", item.file);
    formData.append("description", item.description);
    formData.append("version", item.version);

    uploadImage.mutate(formData, {
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
    return <ImagesLoading />;
  }

  if (isError) {
    console.error(error);
    return <ImagesError />;
  }

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
        className="self-end text-md bg-blue-800"
        onClick={() => setOpen(true)}
      >
        <PlusIcon />
        Add Image
      </Button>

      <VmImageUploadModal
        form={form}
        open={open}
        setOpen={setOpen}
        handleCreate={handleCreate}
      />
      <ImagesList images={images} />
    </div>
  );
};

const ImagesLoading = () => {
  return <div>Images loading...</div>;
};

const ImagesError = () => {
  return <div>An error occured while loading Images!</div>;
};

interface ImagesListI {
  images: Image[];
}

const ImagesList = ({ images }: ImagesListI) => {
  const table = useReactTable({
    data: images,
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
