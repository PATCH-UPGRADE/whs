import { useMutation, useQueryClient } from "@tanstack/react-query";
import { carthageFetcherUpload } from "@/fetcher";
import type { ImportModelsResponse } from "./types";

const EXPORT_MODELS_PATH = "/models/export";
const IMPORT_MODELS_PATH = "/models/import";

const getExportModelsUrl = (): string => {
  if (import.meta.env.DEV) {
    const apiUrl = import.meta.env.VITE_CARTHAGE_API_URL;

    if (!apiUrl) {
      throw new Error("'VITE_CARTHAGE_API_URL' not found in .env!");
    }

    return `http://${apiUrl}${EXPORT_MODELS_PATH}`;
  }

  return `${window.location.origin}/api/v1${EXPORT_MODELS_PATH}`;
};

export const useExportModels = () => {
  return () => {
    window.location.href = getExportModelsUrl();
  };
};

export const useImportModels = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FormData) =>
      carthageFetcherUpload<ImportModelsResponse>(IMPORT_MODELS_PATH, {
        method: "post",
        body: data,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["images"] });
      queryClient.invalidateQueries({ queryKey: ["pcaps"] });
      return data;
    },
    onError: (error) => {
      console.error(error);
    },
  });
};
