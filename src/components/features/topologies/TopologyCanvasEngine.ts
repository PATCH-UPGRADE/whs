import type {
  Core,
  EdgeSingular,
  ElementDefinition,
  EventObject,
  NodeSingular,
} from "cytoscape";
import type { Device, EntangledRouter } from "@/models";

class TopologyCanvasEngine {
  cy: Core;

  constructor(cy: Core) {
    this.cy = cy;

    this.init();
  }

  init(): void {
    this.cy.on("tap", "node", this.onHandleNodeSelect);
    this.cy.on("tap", "edge", this.onHandleEdgeSelect);
    this.cy.on("tap", this.onHandleBackgroundTap);
    this.cy.on("mouseover", "node", this.onHandleNodeMouseOver);
    this.cy.on("mouseout", "node", this.onHandleNodeMouseOut);
    this.cy.on("dragfree", "node", this.onHandleNodeDragFree);
    // this.cy.on("zoom", this.onHandleZoom);
    // this.cy.on("pan", this.onHandlePan);
  }

  dispose(): void {
    this.cy.off("tap", "node", this.onHandleNodeSelect);
    this.cy.off("tap", "edge", this.onHandleEdgeSelect);
    this.cy.off("tap", this.onHandleBackgroundTap);
    this.cy.off("mouseover", "node", this.onHandleNodeMouseOver);
    this.cy.off("mouseout", "node", this.onHandleNodeMouseOut);
    this.cy.off("dragfree", "node", this.onHandleNodeDragFree);
    // this.cy.off("zoom", this.onHandleZoom);
    // this.cy.off("pan", this.onHandlePan);

    this.cy.destroy();
  }

  onHandleNodeSelect = (e: EventObject): void => {
    const node: NodeSingular = e.target;
    console.log("onHandleNodeSelect:", node.id());
  };

  onHandleEdgeSelect = (e: EventObject): void => {
    const edge: EdgeSingular = e.target;
    console.log("onHandleEdgeSelect:", edge.id());
  };

  onHandleBackgroundTap = (e: EventObject): void => {
    if (e.target !== this.cy) {
      return;
    }
  };

  onHandleNodeMouseOver = (e: EventObject): void => {
    const node: NodeSingular = e.target;
    console.log("onHandleNodeMouseOver:", node.id());
  };

  onHandleNodeMouseOut = (e: EventObject): void => {
    const node: NodeSingular = e.target;
    console.log("onHandleNodeMouseOut:", node.id());
  };

  onHandleNodeDragFree = (e: EventObject): void => {
    const node: NodeSingular = e.target;
    console.log("onHandleNodeDragFree:", node.id());
  };

  onHandleZoom = (_e: EventObject): void => {
    // cytoscape handles mouse wheel zoom logic
  };

  onHandlePan = (_e: EventObject): void => {
    // cytoscape handles hold-to-pan mouse logic
  };
}

const buildCytoscapeElements = (
  engine: TopologyCanvasEngine | null,
  router: EntangledRouter | undefined,
  devices: Device[] | undefined,
): ElementDefinition[] => {
  if (!engine?.cy || !router) {
    return [];
  }

  const networkLinks = Object.keys(router.network_links);
  if (networkLinks.length === 0) {
    return [];
  }

  const elements: ElementDefinition[] = [];
  const routerAddresses: string[] = [];

  networkLinks.forEach((linkKey) => {
    const link = router.network_links[linkKey];

    // tier 1 network link nodes
    elements.push({
      data: {
        id: link.net,
        label: link.net,
        type: "network",
      },
    });

    // network link edges
    elements.push({
      data: {
        id: `${link.net}-${link.mac}-${link.address}`,
        source: link.net,
        target: router.name,
        mac: link.mac,
        address: link.address,
      },
    });

    routerAddresses.push(link.address ?? "undefined");
  });

  // tier 2 router node
  elements.push({
    data: {
      id: router.name,
      label: `Router [${routerAddresses}]`,
      type: "router",
    },
  });

  if (devices && devices.length > 0) {
    devices.forEach((device, i) => {
      // tier 3 device nodes

      elements.push({
        data: {
          id: device.id,
          label: `${device.name} (${device.dhcp ? "DHCP" : "Static"})`,
          type: "device",
        },
        classes: device.enabled_for_deployment ? "" : "disabled",
      });

      // device node edges
      elements.push({
        data: {
          id: `${device.id}-${i}`,
          source: device.enabled_for_deployment ? router.name : "disabled",
          target: device.id,
        },
      });
    });
  }

  // seperate Disabled Devices node
  elements.push({
    data: {
      id: "disabled",
      label: "Disabled Devices",
      type: "network",
    },
    classes: "disabled",
  });

  return elements;
};

export { buildCytoscapeElements, TopologyCanvasEngine };
