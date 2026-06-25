import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { Braces, ScreenShare, SlashIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDevice } from "./hooks";
import VncConnection from "./VNCViewer";
import { DeviceType } from "./types";

export const DeviceDetail = () => {
  const { deviceId } = useParams({ from: "/devices/$deviceId" });
  const [currentTab, setCurrentTab] = useState("inspect");
  const vncDesktopNameRef = useRef<HTMLDivElement>(null);
  const vncScreenRef = useRef<HTMLDivElement>(null);
  const vncStatusRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<VncConnection>(null);

  const {
    data: deviceData,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["devices", deviceId],
    queryFn: () => getDevice(deviceId),
  });

  useEffect(() => {
    if (
      connectionRef.current !== null ||
      isPending ||
      isError
    ) {
      return;
    }

    connectionRef.current = new VncConnection(deviceId);
  }, [isPending, isError, deviceId]);

  if (isPending) {
    return <div>Fetching Device...</div>;
  }

  if (isError) {
    console.log(error);
    return <div>Device not found!</div>;
  }

  const isImagePending = (deviceData.type === DeviceType.vm && deviceData.vm_image?.pending) || (deviceData.type === DeviceType.container && deviceData.container_image?.pending);

  return (
    <div className="flex flex-col w-auto h-full">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/devices">All Devices</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <SlashIcon />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>{deviceId}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col mt-3">
        <div className="text-xl">
          <span className="font-bold">Device Name:</span> {deviceData.name}
          {isImagePending && (
            <a href={"/images"}>
              <span className="inline-flex rounded-full bg-amber-100 ml-2 px-2 py-1 text-xs font-medium text-amber-900">Pending image upload</span>
            </a>
          )}
        </div>
        <div className="text-md text-neutral-900">
          <span className="font-bold">Description:</span>{" "}
          {deviceData.description}
        </div>
      </div>

      <Separator className="my-2 pb-0.5" />

      <Tabs defaultValue="inspect" onValueChange={setCurrentTab} className="">
        <TabsList className="p-1 bg-blue-100">
          <TabsTrigger className="text-xl cursor-pointer" value="inspect">
            <Braces />
            Inspect
          </TabsTrigger>
          <TabsTrigger className="text-xl cursor-pointer" value="vnc">
            <ScreenShare />
            VNC
          </TabsTrigger>
        </TabsList>

        <div className="flex flex-col w-full h-full">
          <TabsContent value="inspect">
            <pre className="w-full p-4 overflow-x-auto text-md font-mono rounded-lg bg-zinc-100 text-zinc-800 border border-zinc-200">
              <code className="w-auto">
                {JSON.stringify(deviceData, null, 2)}
              </code>
            </pre>
            <span className="text-red-700">* not all fields shown are relevant to a given device e.g. "container_image" for Virtual Machines</span>
          </TabsContent>
          {/* use forcemount and CSS hide magic to preserve the canvas when TabsContent would otherwise be unrendered */}
          <TabsContent forceMount value="vnc" className={currentTab === "vnc" ? "" : "absolute opacity-0 pointer-events-none -z-10"}>
            <div ref={vncDesktopNameRef} id="vncDesktopName" className="mt-3">
              Desktop: N/A
            </div>
            <div ref={vncStatusRef} id="vncStatus">
              Status: Not Connected
            </div>
            <div ref={vncScreenRef} id="vncScreen" className="mt-1 mx-0"></div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
