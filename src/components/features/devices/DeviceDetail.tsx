import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { SlashIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
    <div>
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

      <div ref={vncDesktopNameRef} id="vncDesktopName" className="mt-3">
        <span>{deviceData.name}</span>
        <span>{deviceData.description}</span>
      </div>

      <Tabs
        defaultValue="inspect"
        onValueChange={setCurrentTab}
        className="w-[400px]"
      >
        <TabsList>
          <TabsTrigger value="inspect">Inspect</TabsTrigger>
          <TabsTrigger value="vnc">VNC</TabsTrigger>
        </TabsList>
        <TabsContent value="inspect">
          <pre className="p-4 my-4 overflow-x-auto text-sm font-mono rounded-lg bg-zinc-100 text-zinc-800 border border-zinc-200">
            <code>{JSON.stringify(deviceData, null, 2)}</code>
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
      </Tabs>
    </div>
  );
};
