import type { Core, EdgeSingular, EventObject, NodeSingular } from "cytoscape";

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

export default TopologyCanvasEngine;
