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
import { EntangledRouter, WhsEntangledNetwork } from "@/models";
import { getCurrentTopology } from "./hooks";
import {
  buildCanvasElementsFromRouter,
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
    "font-size": 2.5,
    width: 10,
    height: 10,
    "text-outline-width": 0.0,
    "text-outline-color": "#000000",
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
    "overlay-padding": 2,
    "overlay-opacity": 0.2,
    "overlay-color": "#737373",
  },
} as const;

const EDGE_STYLE = {
  selector: "edge",
  style: {
    width: 1,
    "line-color": "#d6d3d1",
    "target-arrow-color": "#d6d3d1",
    "target-arrow-shape": "triangle",
    "arrow-scale": 0.4,
    "curve-style": "bezier",
    label: "data(label)",
    "font-size": 2,
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
): Core => {
  return cytoscape({
    container,
    elements,
    style: [
      NODE_STYLE,
      GRABBED_NODE_STYLE,
      SELECTED_NODE_STYLE,
      EDGE_STYLE,
      SELECTED_STYLE,
    ],
    layout: {
      name: layoutName,
      // @ts-expect-error - animate will be ignored if missing on a layout
      animate: false,
      padding: 30,
      randomize: false,
    },
  });
};

export const Topology = () => {
  const {
    data: topology,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["currentTopology"],
    queryFn: getCurrentTopology,
  });
  console.log("topology:", topology);

  const networks = useEntangledList(WhsEntangledNetwork);
  const network = useEntangledObject(networks[0]);

  const routers = useEntangledList(EntangledRouter);
  const router = useEntangledObject(routers[0]) as EntangledRouter;

  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<TopologyCanvasEngine>(null);

  const elements = useMemo(
    () => buildCanvasElementsFromRouter(router),
    [router, router?.network_links],
  );

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const cy = createCytoscape(containerRef.current, "concentric", elements);
    const engine = new TopologyCanvasEngine(cy);
    cyRef.current = engine;

    cy.json({ elements });

    return () => {
      cyRef.current?.dispose();
      cyRef.current = null;
    };
  }, [elements]);

  // const runLayout = (name: LayoutOptions["name"]) => {
  //   cyRef.current?.cy
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
            <BreadcrumbPage>{network?.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex">
        <Button className="" onClick={() => cyRef.current?.cy.fit()}>
          Fit
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
