const EXPORT_MODELS_PATH = "/models/export";

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
