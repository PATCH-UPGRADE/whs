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

const NODE_STYLE = {
  selector: "node",
  style: {
    label: "data(label)",
    "background-color": "#38bdf8",
    color: "#000000",
    "text-valign": "center",
    "text-halign": "center",
    "font-size": 36,
    "text-outline-width": 0.0,
    "text-outline-color": "#000000",
    shape: "rectangle",
    "text-wrap": "wrap",
    "text-max-width": "100px",
    width: "label",
    height: "label",
    padding: "14px",
  },
} as const;

const SELECTED_NODE_STYLE = {
  selector: "node:selected",
  style: {
    "background-color": "#fbbf24",
    "text-outline-color": "#f59e0b",
  },
} as const;

const GRABBED_NODE_STYLE = {
  selector: "node:grabbed",
  style: {
    "overlay-padding": 24,
    "overlay-opacity": 0.25,
    "overlay-color": "#737373",
  },
} as const;

const DISABLED_NODE_STYLE = {
  selector: "node.disabled",
  style: {
    "background-color": "#a1a1aa",
  },
} as const;

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

const SELECTED_STYLE = {
  selector: "node:selected",
  style: {
    "background-color": "#f59e0b",
    "text-outline-color": "#f59e0b",
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
    style: [
      NODE_STYLE,
      GRABBED_NODE_STYLE,
      SELECTED_NODE_STYLE,
      DISABLED_NODE_STYLE,
      EDGE_STYLE,
      SELECTED_STYLE,
    ],
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
