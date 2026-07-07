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
import { getPcaps, useUploadPcap } from "./hooks";
import {
  type Pcap,
  type PcapUploadFormValues,
  pcapUploadInputSchema,
} from "./types";

export const PcapUploadForm = ({
  form,
  handleCreate,
  open,
  setOpen,
}: {
  form: UseFormReturn<PcapUploadFormValues>;
  handleCreate: (values: PcapUploadFormValues) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  isUpdate?: boolean;
}) => {
  const onSubmit = (values: PcapUploadFormValues) => {
    handleCreate(values);
  };

  const isPending = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 rounded-2xl w-6xl lg:max-w-2xl overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b gap-1">
          <DialogTitle className="text-xl">Upload Pcap</DialogTitle>
          <DialogDescription>Upload your PCAP file here</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, (e) => console.error(e))}
            id="pcap-form"
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
                        accept=".pcap, .pcapng"
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
            </div>
          </form>
        </Form>
        <DialogFooter className="px-6 py-4 bg-muted border-t justify-between!">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" form="pcap-form" disabled={isPending}>
            Upload Pcap
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const PcapsContainer = () => {
  const {
    data: pcaps,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["pcaps"],
    queryFn: getPcaps,
  });

  const uploadPcap = useUploadPcap();
  const [open, setOpen] = useState(false);

  const form = useForm<PcapUploadFormValues>({
    resolver: zodResolver(pcapUploadInputSchema),
    defaultValues: {
      file: undefined,
      description: "",
    },
  });

  const handleCreate = (item: PcapUploadFormValues) => {
    // repack data as FormData so the browser auto sets the header to
    // Content-Type: multipart/form-data. the browser has to do it itself
    const formData = new FormData();
    formData.append("file", item.file);
    formData.append("description", item.description);

    uploadPcap.mutate(formData, {
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
    return <PcapsLoading />;
  }

  if (isError) {
    console.error(error);
    return <PcapsError />;
  }

  return (
    <div className="flex flex-col">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/pcaps">All PCAPs</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <SlashIcon />
          </BreadcrumbSeparator>
        </BreadcrumbList>
      </Breadcrumb>

      <Button
        className="self-end text-md font-semibold bg-blue-800 mb-1 hover:bg-blue-700 transition-color"
        onClick={() => setOpen(true)}
      >
        <PlusIcon />
        Add PCAP
      </Button>

      <PcapUploadForm
        form={form}
        open={open}
        setOpen={setOpen}
        handleCreate={handleCreate}
      />
      <PcapsList pcaps={pcaps} />
    </div>
  );
};

const PcapsLoading = () => {
  return <div>PCAPs loading...</div>;
};

const PcapsError = () => {
  return <div>An error occured while loading PCAPs!</div>;
};

interface PcapsListI {
  pcaps: Pcap[];
}

const PcapsList = ({ pcaps }: PcapsListI) => {
  const table = useReactTable({
    data: pcaps,
    columns: columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded border border-gray-300">
      <table className="w-full text-left text-sm">
        <thead className="bg-blue-200">
          {table.getHeaderGroups().map((headerGroup, index) => (
            <tr key={index}>
              {headerGroup.headers.map((header, index) => (
                <th
                  key={index}
                  className="border-b border-gray-200 px-4 py-3 font-bold uppercase text-md tracking-wide"
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
        <tbody className="divide-y divide-gray-100">
          {table.getRowModel().rows.map((row, index) => (
            <tr
              key={index}
              className="odd:bg-white even:bg-blue-50 cursor-pointer transition-colors hover:bg-gray-200 text-md"
            >
              {row.getVisibleCells().map((cell, index) => (
                <td
                  key={index}
                  className="max-w-[125px] truncate px-4 py-3 text-gray-700"
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
