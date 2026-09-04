import { BoxIcon, ComputerIcon, Plug2Icon } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";

const urls = [
  { name: "VM Images", path: "/images", iconElement: BoxIcon },
  { name: "Devices", path: "/devices", iconElement: ComputerIcon },
  // { name: "PCAPs", path: "/pcaps", iconElement: EthernetPortIcon },
  { name: "Deploy", path: "/deploy", iconElement: Plug2Icon },
  // { name: "Import / Export", path: "/import-export", iconElement: ArrowDownUpIcon },
];

export const AppSidebar: React.FC = () => {
  const path = window.location.pathname;

  return (
    <div className="fixed left-0 top-0 flex h-screen bg-muted">
      <div className="w-64 bg-white border-r-3 border-gray-300">
        <div className="p-3 border-b-3 border-gray-300">
          <h1 className="flex justify-center text-center text-lg font-bold">
            Whole Hospital Simulator
          </h1>
        </div>
        <nav className="flex flex-col gap-1 mt-2">
          {urls.map((url, index) => (
            <a
              key={index}
              href={url.path}
              className={cn(
                "flex items-center gap-3 px-6 py-3 font-medium text-gray-700 border-l-6 border-gray-500 hover:bg-muted",
                path.includes(url.path) &&
                  "font-bold bg-blue-50 border-blue-600 text-blue-600",
              )}
            >
              <url.iconElement />
              <span className="">{url.name}</span>
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
};
