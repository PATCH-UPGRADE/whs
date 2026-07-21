import cytoscape, { type Core, type LayoutOptions } from "cytoscape";
import { useEffect, useRef } from "react";
import TopologyCanvasEngine from "./TopologyCanvasEngine";

const initialElements = [
  { data: { id: "a", label: "A" } },
  { data: { id: "b", label: "B" } },
  { data: { id: "c", label: "C" } },
  { data: { id: "ab", source: "a", target: "b", label: "connects" } },
  { data: { id: "bc", source: "b", target: "c", label: "connects" } },
];

const getCytoscape = (
  container: HTMLDivElement,
  layoutName: LayoutOptions["name"],
): Core => {
  return cytoscape({
    container,
    elements: initialElements,
    style: [
      {
        selector: "node",
        style: {
          label: "data(label)",
          "background-color": "#6366f1",
          color: "#ffffff",
          "text-valign": "center",
          "text-halign": "center",
          "font-size": 12,
          width: 40,
          height: 40,
          "text-outline-width": 2,
          "text-outline-color": "#6366f1",
        },
      },
      {
        selector: "edge",
        style: {
          width: 2,
          "line-color": "#94a3b8",
          "target-arrow-color": "#94a3b8",
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
          label: "data(label)",
          "font-size": 10,
          color: "#475569",
          events: "no", // ignores mouse events
        },
      },
      {
        selector: "node:selected",
        style: {
          "background-color": "#f59e0b",
          "text-outline-color": "#f59e0b",
        },
      },
    ],
    layout: {
      name: layoutName,
      // animate: true
    },
  });
};

export const Topology = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<TopologyCanvasEngine>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const cy = getCytoscape(containerRef.current, "grid");
    const engine = new TopologyCanvasEngine(cy);
    cyRef.current = engine;

    return () => {
      cyRef.current?.dispose();
      cyRef.current = null;
    };
  }, []);

  const runLayout = (name: LayoutOptions["name"]) => {
    cyRef.current?.cy.layout({ name }).run();
  };

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="border-2 p-2 hover:bg-neutral-200"
          onClick={() => cyRef.current?.cy.fit()}
        >
          Fit
        </button>{" "}
        <button
          type="button"
          className="border-2 p-2 hover:bg-neutral-200"
          onClick={() => runLayout("grid")}
        >
          Grid Layout
        </button>{" "}
        <button
          type="button"
          className="border-2 p-2 hover:bg-neutral-200"
          onClick={() => runLayout("cose")}
        >
          Cose Layout
        </button>
      </div>

      <div
        ref={containerRef}
        style={{ width: "100%", height: 480, border: "1px solid #e2e8f0" }}
      />
    </div>
  );
};
