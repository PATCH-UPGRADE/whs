import type React from "react";
import { cn } from "@/lib/utils";

const urls = [
  { name: "Devices", path: "/devices" },
  { name: "VM Images", path: "/images" },
  { name: "PCAPs", path: "/pcaps" },
  { name: "Deploy", path: "/topologies" }, // TODO: Make this proper once WHS backend supports multiple deploys
  { name: "Import / Export", path: "/import-export" },
  { name: "Topology", path: "/topology" },
];

export const AppSidebar: React.FC = () => {
  const path = window.location.pathname;

  return (
    <div className="fixed left-0 top-0 flex h-screen bg-muted">
      <div className="w-64 bg-white border-r-3 border-gray-300">
        <div className="p-6 border-b-3 border-gray-300">
          <h1 className="text-2xl font-bold">W.H.S.</h1>
        </div>
        <nav className="flex flex-col gap-1 mt-2">
          {urls.map((url, index) => (
            <a
              key={index}
              href={url.path}
              className={cn(
                "flex items-center px-6 py-3 font-medium text-gray-700 border-l-6 border-gray-500 hover:bg-muted",
                path.includes(url.path) &&
                  "font-bold bg-blue-50 border-blue-600",
              )}
            >
              <span className="mx-3">{url.name}</span>
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
};
