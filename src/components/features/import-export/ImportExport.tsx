import { DownloadIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExportModels } from "./hooks";

export const ImportExportContainer = () => {
  const exportModels = useExportModels();

  const handleImport = () => undefined;
  const handleExport = () => {
    exportModels();
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Import / Export</h1>
      <div className="flex flex-wrap gap-3">
        <Button type="button" className="bg-blue-800" onClick={handleImport}>
          <UploadIcon />
          Import
        </Button>
        <Button type="button" variant="outline" onClick={handleExport}>
          <DownloadIcon />
          Export
        </Button>
      </div>
    </div>
  );
};
