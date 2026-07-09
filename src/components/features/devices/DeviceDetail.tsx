import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { Braces, ScreenShare, SlashIcon, SquareTerminal } from "lucide-react";
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
import { cn } from "@/lib/utils";
import ConsoleConnection from "./ConsoleConnection";
import { getDevice } from "./hooks";
import { DeviceType } from "./types";
import VncConnection from "./VncConnection";

const TABS = [
  {
    displayed: "Inspect",
    value: "inspect",
    iconElement: Braces,
  },
  {
    displayed: "VNC",
    value: "vnc",
    iconElement: ScreenShare,
  },
  {
    displayed: "Console",
    value: "console",
    iconElement: SquareTerminal,
  },
];

export const DeviceDetail = () => {
  const { deviceId } = useParams({ from: "/devices/$deviceId" });

  const [currentTab, setCurrentTab] = useState(TABS[0].value);
  const [vncStarted, setVncStarted] = useState(false);
  const [consoleStarted, setConsoleStarted] = useState(false);

  const vncConnectionRef = useRef<VncConnection>(null);
  const consoleConnectionRef = useRef<ConsoleConnection>(null);

  const {
    data: deviceData,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["devices", deviceId],
    queryFn: () => getDevice(deviceId),
  });

  const startVnc = () => {
    if (vncConnectionRef.current) {
      return;
    }

    vncConnectionRef.current = new VncConnection(deviceId);
    setVncStarted(true);
  };

  const startConsole = () => {
    if (consoleConnectionRef.current) {
      return;
    }

    consoleConnectionRef.current = new ConsoleConnection(deviceId);
    setConsoleStarted(true);
  };

  useEffect(() => {
    return () => {
      if (vncConnectionRef.current !== null) {
        vncConnectionRef.current.dispose();
      }

      if (consoleConnectionRef.current !== null) {
        consoleConnectionRef.current.dispose();
      }
    };
  }, []);

  if (isPending) {
    return <div>Fetching Device...</div>;
  }

  if (isError) {
    console.log(error);
    return <div>Device not found!</div>;
  }

  const isImagePending =
    (deviceData.type === DeviceType.vm && deviceData.vm_image?.pending) ||
    (deviceData.type === DeviceType.container &&
      deviceData.container_image?.pending);

  return (
    <div className="flex flex-col w-auto">
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
              <span className="inline-flex rounded-full bg-amber-100 ml-2 px-2 py-1 text-xs font-medium text-amber-900">
                Pending image upload
              </span>
            </a>
          )}
        </div>
        <div className="text-md text-neutral-900">
          <span className="font-bold">Description:</span>{" "}
          {deviceData.description}
        </div>
      </div>

      <Separator className="my-2 pb-0.5" />

      <Tabs
        defaultValue={currentTab}
        onValueChange={setCurrentTab}
        className=""
      >
        <TabsList className="bg-blue-100">
          {TABS.map((tab, index) => (
            <TabsTrigger
              key={index}
              className="text-lg cursor-pointer"
              value={tab.value}
            >
              <tab.iconElement />
              {tab.displayed}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="w-full">
          <TabsContent value="inspect">
            <pre className="w-full p-4 overflow-x-auto text-md font-mono rounded bg-zinc-100 text-zinc-800 border border-zinc-200">
              <code className="w-auto">
                {JSON.stringify(deviceData, null, 2)}
              </code>
            </pre>
            <span className="text-red-700">
              * not all fields shown are relevant to a given device e.g.
              "container_image" for Virtual Machines
            </span>
          </TabsContent>

          {/* use forcemount and CSS magic to prevent important elements from unrendering */}
          <TabsContent
            forceMount
            value="vnc"
            className={
              currentTab === "vnc"
                ? ""
                : "absolute h-0 overflow-hidden opacity-0 pointer-events-none -z-10"
            }
          >
            {/* <div id="vncDesktopName" className="mt-3">
              Desktop: N/A
            </div>
            <div id="vncStatus">Status: Not Connected</div> */}

            <div
              className={cn(
                "flex justify-center items-center w-96 h-64 bg-neutral-800 rounded",
                vncStarted && "hidden",
              )}
            >
              <button
                type="button"
                onClick={startVnc}
                disabled={vncStarted}
                className="w-48 px-3 py-1.5 rounded bg-blue-600 text-white text-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {vncStarted ? "VNC Connected" : "Connect"}
              </button>
            </div>

            <div
              id="vncScreen"
              className={cn(
                "w-fit bg-black p-2 border-2 rounded",
                !vncStarted && "hidden",
              )}
            ></div>
          </TabsContent>

          <TabsContent
            forceMount
            value="console"
            className={
              currentTab === "console"
                ? ""
                : "absolute h-0 overflow-hidden opacity-0 pointer-events-none -z-10"
            }
          >
            <div
              className={cn(
                "flex justify-center items-center w-96 h-64 bg-neutral-800 rounded",
                consoleStarted && "hidden",
              )}
            >
              <button
                type="button"
                onClick={startConsole}
                disabled={consoleStarted}
                className="w-48 px-3 py-1.5 rounded bg-blue-600 text-white text-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {consoleStarted ? "Console Connected" : "Connect"}
              </button>
            </div>

            <div
              id="consoleScreen"
              className={cn(
                "inline-block bg-black p-2 border-2 rounded",
                !consoleStarted && "hidden",
              )}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
