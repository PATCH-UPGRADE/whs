import { zodResolver } from "@hookform/resolvers/zod";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { useState } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
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
import { useExportModels, useImportModels } from "./hooks";
import {
  type ImportModelsFormValues,
  importModelsInputSchema,
} from "./types";

const ImportModelsModal = ({
  form,
  handleImport,
  open,
  setOpen,
}: {
  form: UseFormReturn<ImportModelsFormValues>;
  handleImport: (values: ImportModelsFormValues) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) => {
  const onSubmit = (values: ImportModelsFormValues) => {
    handleImport(values);
  };

  const isPending = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 rounded-2xl w-6xl lg:max-w-2xl overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b gap-1">
          <DialogTitle className="text-xl">Import Models</DialogTitle>
          <DialogDescription>
            Upload a previously exported WHS models YAML file.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, (e) => console.error(e))}
            id="import-models-form"
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
                      Accepts `.yaml` and `.yml` model exports.
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="file"
                        accept=".yaml, .yml, application/x-yaml, text/yaml"
                        onChange={(e) => {
                          field.onChange(e.target.files?.[0]);
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
          <Button type="submit" form="import-models-form" disabled={isPending}>
            Import Models
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ImportExportContainer = () => {
  const exportModels = useExportModels();
  const importModels = useImportModels();
  const [open, setOpen] = useState(false);
  const form = useForm<ImportModelsFormValues>({
    resolver: zodResolver(importModelsInputSchema),
    defaultValues: {
      file: undefined,
    },
  });

  const handleImport = (values: ImportModelsFormValues) => {
    const formData = new FormData();
    formData.append("file", values.file);

    importModels.mutate(formData, {
      onSuccess: () => {
        form.reset();
        setOpen(false);
      },
      onError: () => {
        setOpen(true);
      },
    });
  };
  const handleExport = () => {
    exportModels();
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Import / Export</h1>
      <div className="flex flex-wrap gap-3">
        <Button type="button" className="bg-blue-800" onClick={() => setOpen(true)}>
          <UploadIcon />
          Import
        </Button>
        <Button type="button" variant="outline" onClick={handleExport}>
          <DownloadIcon />
          Export
        </Button>
      </div>
      <ImportModelsModal
        form={form}
        handleImport={handleImport}
        open={open}
        setOpen={setOpen}
      />
    </div>
  );
};
