import { useMutation, useQueryClient } from "@tanstack/react-query";
import { carthageFetcher } from "@/fetcher";
import type { Device, DeviceFormValues } from "./types";

export const getDevices = () => carthageFetcher<Device[]>("/devices");
export const getDevice = (id: string) =>
  carthageFetcher<Device>(`/devices/${id}`);

export const useCreateDevice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newDevice: DeviceFormValues) =>
      carthageFetcher<Device>(`/devices`, {
        method: "POST",
        body: JSON.stringify(newDevice),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      return data;
    },
    onError: (error) => {
      console.error(error);
    },
  });
};

export const useUpdateDevice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updateDevice,
    }: {
      id: string;
      updateDevice: DeviceFormValues;
    }) =>
      carthageFetcher<Device>(`/devices/${id}`, {
        method: "PUT",
        body: JSON.stringify(updateDevice),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      return data;
    },
    onError: (error) => {
      console.error(error);
    },
  });
};

export const useDeleteDevice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      carthageFetcher<Device>(`/devices/${id}`, {
        method: "DELETE",
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      return data;
    },
    onError: (error) => {
      console.error(error);
    },
  });
};
