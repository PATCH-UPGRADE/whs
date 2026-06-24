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

export const DeviceDetail = () => {
  const { deviceId } = useParams({ from: "/devices/$deviceId" });
  const [currentTab, setCurrentTab] = useState("inspect");
  const vncDesktopNameRef = useRef<HTMLDivElement>(null);
  const vncScreenRef = useRef<HTMLDivElement>(null);
  const vncStatusRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<VncConnection | null>(null);

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
      isPending ||
      isError ||
      currentTab !== "vnc" ||
      connectionRef.current !== null
    ) {
      return;
    }

    connectionRef.current = new VncConnection(deviceId);
  }, [isPending, isError, currentTab, deviceId]);

  if (isPending) {
    return <div>Fetching Device...</div>;
  }

  if (isError) {
    console.log(error);
    return <div>Device not found!</div>;
  }

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
        <div className="text-lg">
          <span className="font-bold">Device Name:</span> {deviceData.name}
        </div>
        <div className="text-md">
          <span className="font-bold">Description:</span>{" "}
          {deviceData.description}
        </div>
      </div>

      <Separator className="my-2 pb-0.5" />

      <Tabs defaultValue="inspect" onValueChange={setCurrentTab} className="">
        <TabsList>
          <TabsTrigger className="text-lg cursor-pointer" value="inspect">
            <Braces />
            Inspect
          </TabsTrigger>
          <TabsTrigger className="text-lg cursor-pointer" value="vnc">
            <ScreenShare />
            VNC
          </TabsTrigger>
        </TabsList>

        <div className="flex flex-col w-full h-full">
          <TabsContent value="inspect">
            <pre className="w-full p-4 my-4 overflow-x-auto text-md font-mono rounded-lg bg-zinc-100 text-zinc-800 border border-zinc-200">
              <code className="w-auto">
                {JSON.stringify(deviceData, null, 2)}
              </code>
            </pre>
          </TabsContent>
          <TabsContent value="vnc">
            <div ref={vncDesktopNameRef} id="vncDesktopName" className="mt-3">
              N/A
            </div>
            <div ref={vncStatusRef} id="vncStatus">
              Not Connected
            </div>
            <div ref={vncScreenRef} id="vncScreen" className="mt-1"></div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
