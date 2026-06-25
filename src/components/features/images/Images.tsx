import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
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
import { getImages, useUploadImage } from "./hooks";
import {
  type Image,
  type ImageUploadFormValues,
  imageUploadInputSchema,
} from "./types";

export const ImageUploadModal = ({
  form,
  handleCreate,
  open,
  pendingImage,
  setOpen,
}: {
  form: UseFormReturn<ImageUploadFormValues>;
  handleCreate: (values: ImageUploadFormValues) => void;
  open: boolean;
  pendingImage?: Image | null;
  setOpen: (open: boolean) => void;
  isUpdate?: boolean;
}) => {
  const onSubmit = (values: ImageUploadFormValues) => {
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
  const [pendingImage, setPendingImage] = useState<Image | null>(null);

  const form = useForm<ImageUploadFormValues>({
    resolver: zodResolver(imageUploadInputSchema),
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

  const handleCreate = (item: ImageUploadFormValues) => {
    // repack data as FormData so the browser auto sets the header to
    // Content-Type: multipart/form-data. the browser has to do it itself
    const formData = new FormData();
    formData.append("file", item.file);
    formData.append("description", item.description);
    formData.append("version", item.version);

    uploadImage.mutate(formData, {
      onSuccess: () => {
        setOpen(false);
      },
      onError: () => {
        setOpen(true);
      },
    });
  };

  const handleOpenNewUpload = () => {
    setPendingImage(null);
    setOpen(true);
  };

  const handleOpenPendingUpload = (image: Image) => {
    setPendingImage(image);
    setOpen(true);
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
        className="self-end text-md bg-blue-800 mb-1"
        onClick={handleOpenNewUpload}
      >
        <PlusIcon />
        Add Image
      </Button>

      <ImageUploadModal
        form={form}
        open={open}
        pendingImage={pendingImage}
        setOpen={setOpen}
        handleCreate={handleCreate}
      />
      <ImagesList images={images} onUploadPending={handleOpenPendingUpload} />
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
  onUploadPending: (image: Image) => void;
}

const ImagesList = ({ images, onUploadPending }: ImagesListI) => {
  const table = useReactTable({
    data: images,
    columns: getImageColumns({ onUploadPending }),
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <table className="w-full border border-black text-left">
        <thead>
          {table.getHeaderGroups().map((headerGroup, index) => (
            <tr key={index}>
              {headerGroup.headers.map((header, index) => (
                <th key={index} className="border-b border-black p-2">
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
            <tr
              key={index}
              className="odd:bg-white even:bg-muted"
            >
              {row.getVisibleCells().map((cell, index) => (
                <td
                  key={index}
                  className="border-black p-2 max-w-[125px] truncate"
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
