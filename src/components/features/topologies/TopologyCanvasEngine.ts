import type {
  Core,
  EdgeSingular,
  ElementDefinition,
  EventObject,
  NodeSingular,
} from "cytoscape";
import type { EntangledRouter } from "@/models";

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

const buildCanvasElementsFromRouter = (
  router: EntangledRouter | undefined,
): ElementDefinition[] => {
  if (!router) {
    return [];
  }

  const links = Object.keys(router.network_links);
  if (links.length === 0) {
    return [];
  }

  const elements: ElementDefinition[] = [
    {
      data: {
        id: router.name,
        label: router.name,
        type: "router",
      },
    },
  ];

  links.forEach((linkKey, _i) => {
    const link = router.network_links[linkKey];

    // router is the root node
    elements.push({
      data: {
        id: link.net,
        label: link.net,
        type: "network",
      },
    });

    elements.push({
      data: {
        id: `${link.net}-${link.mac}-${link.address}`,
        source: router.name,
        target: link.net,
        label: link.address,
        mac: link.mac,
        address: link.address,
      },
    });
  });

  return elements;
};

export { buildCanvasElementsFromRouter, TopologyCanvasEngine };
