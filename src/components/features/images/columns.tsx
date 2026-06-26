import type { ColumnDef } from "@tanstack/react-table";
import { TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeleteImage } from "./hooks";
import type { Image } from "./types";

export const getImageColumns = ({
  onUploadPending,
}: {
  onUploadPending: (image: Image) => void;
}): ColumnDef<Image>[] => [
  {
    accessorKey: "id",
    meta: { title: "id" },
    header: "UUID",
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
        <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
          Pending upload
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">Uploaded</span>
      ),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const deleteImage = useDeleteImage();
      const handleRemove = () => {
        deleteImage.mutate({ id: row.original.id });
      };

      return (
        <div className="flex justify-between">
          {row.original.pending && (
            <Button
              type="button"
              size="sm"
              onClick={() => onUploadPending(row.original)}
            >
              Upload
            </Button>
          )}
          <Button
            className=""
            onClick={handleRemove}
            disabled={deleteImage.isPending}
            variant="destructive"
          >
            <TrashIcon />
            Delete
          </Button>
        </div>
      );
    },
  },
];
