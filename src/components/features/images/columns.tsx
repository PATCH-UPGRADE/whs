import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DeviceImage } from "./types";

export const getImageColumns = ({
  onUploadPending,
}: {
  onUploadPending: (image: DeviceImage) => void;
}): ColumnDef<DeviceImage>[] => [
  // {
  //   accessorKey: "id",
  //   meta: { title: "id" },
  //   header: "ID",
  // },
  {
    accessorKey: "name",
    meta: { title: "name" },
    header: "Image Name",
  },
  {
    accessorKey: "description",
    meta: { title: "description" },
    header: "Description",
  },
  {
    accessorKey: "type",
    meta: { title: "type" },
    header: "Type",
  },
  {
    accessorKey: "version",
    meta: { title: "version" },
    header: "Version",
  },
  {
    accessorKey: "pending",
    meta: { title: "pending" },
    header: "Status",
    cell: ({ row }) =>
      row.original.pending ? (
        <Badge variant={"red"}>Pending Upload</Badge>
      ) : (
        <Badge variant={"green"}>Uploaded</Badge>
      ),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) =>
      row.original.pending ? (
        <Button type="button" onClick={() => onUploadPending(row.original)}>
          Upload
        </Button>
      ) : null,
  },
];
