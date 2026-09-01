import { useMutation, useQueryClient } from "@tanstack/react-query";
import { carthageFetcher, carthageFetcherUpload } from "@/fetcher";
import type { DeviceImage, UploadDeviceImageResponseSchema } from "./types";

export const getImages = () => carthageFetcher<DeviceImage[]>("/images");

export const useUploadImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FormData) =>
      carthageFetcherUpload<UploadDeviceImageResponseSchema>(`/images/upload`, {
        method: "post",
        body: data,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["images"],
      });
      return data;
    },
    onError: (error) => {
      console.error(error);
    },
  });
};
