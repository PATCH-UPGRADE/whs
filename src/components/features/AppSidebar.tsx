import type React from "react";
import { cn } from "@/lib/utils";

const urls = [
  { name: "Devices", path: "/devices" },
  { name: "VM Images", path: "/images" },
  { name: "PCAPs", path: "/pcaps" },
  { name: "Deploy", path: "/topologies" }, // TODO: Make this proper once WHS backend supports multiple deploys
  { name: "Import / Export", path: "/import-export" },
];

export const AppSidebar: React.FC = () => {
  const path = window.location.pathname;

  return (
    <div className="flex h-screen bg-muted">
      <div className="w-64 bg-white shadow-md">
        <div className="p-6">
          <h1 className="text-2xl font-bold">WHS</h1>
        </div>
        <nav className="mt-6">
          {urls.map((url, index) => (
            <a
              key={index}
              href={url.path}
              className={cn(
                "flex items-center px-6 py-3 text-gray-700 border-r-4 hover:bg-muted",
                path.includes(url.path) && "bg-muted border-blue-600",
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
