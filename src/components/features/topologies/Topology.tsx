import { useQuery } from "@tanstack/react-query";
import cytoscape, {
  type Core,
  type ElementDefinition,
  type LayoutOptions,
} from "cytoscape";
import { useEntangledList, useEntangledObject } from "entanglement-react";
import { SlashIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Device, EntangledRouter, WhsEntangledNetwork } from "@/models";
import { getCurrentTopology } from "./hooks";
import {
  buildCytoscapeElements,
  TopologyCanvasEngine,
} from "./TopologyCanvasEngine";

// cytoscape cannot change color so we need to edit the color here
const networkIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-network preview-icon"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>';
const routerIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-router preview-icon"><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6.01 18H6"/><path d="M10.01 18H10"/><path d="M15 10v4"/><path d="M17.84 7.17a4 4 0 0 0-5.66 0"/><path d="M20.66 4.34a8 8 0 0 0-11.31 0"/></svg>';
const deviceIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-monitor preview-icon"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>';

const networkIconDataUri = encodeURIComponent(networkIcon);
const routerIconDataUri = encodeURIComponent(routerIcon);
const deviceIconDataUri = encodeURIComponent(deviceIcon);

const networkIconUrl = `data:image/svg+xml;utf8,${networkIconDataUri}`;
const routerIconUrl = `data:image/svg+xml;utf8,${routerIconDataUri}`;
const deviceIconUrl = `data:image/svg+xml;utf8,${deviceIconDataUri}`;

const NODE_STYLES = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      // "background-color": "#38bdf8",
      "background-opacity": 0,
      "background-fit": "contain",
      // color: "#000000",
      "text-valign": "bottom" as const,
      "text-halign": "center" as const,
      "font-size": 18,
      // "text-outline-width": 0.0,
      // "text-outline-color": "#000000",
      shape: "square",
      "text-wrap": "wrap" as const,
      "text-max-width": "60px",
      width: "50px",
      height: "50px",
      padding: "12px",
    },
  },
  {
    selector: "node:selected",
    style: {
      "background-color": "#fbbf24",
      "text-outline-color": "#f59e0b",
    },
  },
  {
    selector: "node:grabbed",
    style: {
      "overlay-padding": 16,
      "overlay-opacity": 0.25,
      "overlay-color": "#737373",
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-color": "#ef4444",
      "border-width": "3px",
      "border-opacity": 1.0,
    },
  },
  {
    selector: "node.message",
    style: {
      "background-opacity": 1,
      "background-color": "#bae6fd",
      "text-max-width": "100px",
      shape: "rectangle",
      "text-valign": "center" as const,
      "text-halign": "center" as const,
      width: "label",
      height: "label",
      padding: "12px",
      "font-size": 20,
    },
  },
  {
    selector: "node.disabled",
    style: {
      "background-color": "#d6d3d1",
    },
  },
  {
    selector: "node.network",
    style: {
      "background-image": networkIconUrl,
      // "background-fit": "contain"
    },
  },
  {
    selector: "node.router",
    style: {
      "background-image": routerIconUrl,
      // "background-fit": "contain"
    },
  },
  {
    selector: "node.device",
    style: {
      "background-image": deviceIconUrl,
      // "background-fit": "contain"
    },
  },
];

const EDGE_STYLE = {
  selector: "edge",
  style: {
    width: 4,
    "line-color": "#d6d3d1",
    "target-arrow-color": "#d6d3d1",
    "target-arrow-shape": "none",
    "arrow-scale": 0.4,
    "curve-style": "bezier",
    label: "data(label)",
    "font-size": 20,
    color: "#000000",
    events: "no", // ignores mouse events prevents highlighting
  },
} as const;

const createCytoscape = (
  container: HTMLDivElement,
  layoutName: LayoutOptions["name"],
  elements: ElementDefinition[],
  router: EntangledRouter,
): Core => {
  const roots = Object.values(router.network_links).map((l) => l.net);
  roots.push("disabled"); // special node for disabled devices

  return cytoscape({
    container,
    elements,
    roots,
    style: [...NODE_STYLES, EDGE_STYLE],
    layout: {
      name: layoutName,
      // @ts-expect-error - missing properties for a specific layout will be ignored
      directed: true,
      animate: false,
      padding: 10,
      randomize: false,
    },
  });
};

export const Topology = () => {
  const { data: topology } = useQuery({
    queryKey: ["currentTopology"],
    queryFn: getCurrentTopology,
  });

  const networks = useEntangledList(WhsEntangledNetwork);
  const routers = useEntangledList(EntangledRouter);
  const devices = useEntangledList(Device);

  const _network = useEntangledObject(networks[0]);
  const router = useEntangledObject(routers[0]) as EntangledRouter;

  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<TopologyCanvasEngine>(null);

  const elements = useMemo(
    () =>
      buildCytoscapeElements(engineRef.current, router, devices as Device[]),
    [router, router?.network_links, devices],
  );

  useEffect(() => {
    if (!containerRef.current || !router) {
      return;
    }

    const cy = createCytoscape(
      containerRef.current,
      "breadthfirst",
      elements,
      router,
    );
    const engine = new TopologyCanvasEngine(cy);
    engineRef.current = engine;

    cy.json({ elements });

    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [elements, router]);

  // const runLayout = (name: LayoutOptions["name"]) => {
  //   engineRef.current?.cy
  //     // @ts-expect-error - missing properties of one type will be ignored by others anyways
  //     .layout({ name, animate: false, fit: false, padding: 20 })
  //     .run();
  // };

  return (
    <div className="flex flex-col gap-2">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/topology">All Topologies</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <SlashIcon />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>{topology?.current_topology}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex">
        <Button className="" onClick={() => engineRef.current?.cy.fit()}>
          Fit Graph
        </Button>
        {/* <Button className="" onClick={() => runLayout("breadthfirst")}>
          Breadthfirst Layout
        </Button>
        <Button className="" onClick={() => runLayout("cose")}>
          Cose Layout
        </Button> */}
      </div>

      <div
        ref={containerRef}
        className="w-full h-[500px] border border-slate-200"
      />
    </div>
  );
};
