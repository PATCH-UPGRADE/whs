import type { Control } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Image } from "../images/types";
import type { DeviceFormValues } from "./types";

const NO_IMAGE_VALUE = "__none__";

const getImageOptionLabel = (image: Image) => {
  const versionLabel = image.version ? ` (${image.version})` : "";
  return `${image.name}${versionLabel}`;
};

interface DeviceImageSelectFieldProps {
  control: Control<DeviceFormValues>;
  images: Image[];
  imagesError: boolean;
}

export const DeviceImageSelectField = ({
  control,
  images,
  imagesError,
}: DeviceImageSelectFieldProps) => {
  return (
    <FormField
      control={control}
      name="image_id"
      render={({ field }) => {
        const selectedValue = field.value ?? NO_IMAGE_VALUE;
        const missingImageValue = field.value ?? NO_IMAGE_VALUE;
        const selectedImageMissing =
          field.value !== null &&
          !images.some((image) => image.id === field.value);

        return (
          <FormItem>
            <FormLabel>Image</FormLabel>
            <FormDescription>
              Select the software image for this device.
            </FormDescription>
            <FormControl>
              <Select
                onValueChange={(value) => {
                  field.onChange(value === NO_IMAGE_VALUE ? null : value);
                }}
                value={selectedValue}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an image" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_IMAGE_VALUE}>No image</SelectItem>
                  {images.map((image) => (
                    <SelectItem key={image.id} value={image.id}>
                      {getImageOptionLabel(image)}
                    </SelectItem>
                  ))}
                  {selectedImageMissing ? (
                    <SelectItem value={missingImageValue}>
                      {`Unavailable image (${field.value})`}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </FormControl>
            {imagesError ? (
              <FormDescription>Unable to load images right now.</FormDescription>
            ) : null}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
};
