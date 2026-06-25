import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import type { Image } from "./types";

export const getImageColumns = ({
  onUploadPending,
}: {
  onUploadPending: (image: Image) => void;
}): ColumnDef<Image>[] => [
  {
    accessorKey: "id",
    meta: { title: "id" },
    header: "ID",
  },
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
        <a href={"/images"}>
          <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-900">Pending upload</span>
        </a>
      ) : (
        <span className="">Uploaded</span>
      ),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) =>
      row.original.pending ? (
        <Button
          type="button"
          onClick={() => onUploadPending(row.original)}
        >
          Upload
        </Button>
      ) : null,
  },
];
