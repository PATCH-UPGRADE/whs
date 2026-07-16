import cytoscape from "cytoscape";
import { Ref, useEffect, useRef } from "react";

const initialElements = [
  { data: { id: "a", label: "A" } },
  { data: { id: "b", label: "B" } },
  { data: { id: "c", label: "C" } },
  { data: { id: "ab", source: "a", target: "b", label: "connects" } },
  { data: { id: "bc", source: "b", target: "c", label: "connects" } },
];

const getCytoscape = (containerRef: Ref<HTMLDivElement>) => {
  return cytoscape({
    container: containerRef.current,
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
    layout: { name: layoutName, animate: true },
  });
}
 
export const Topology = () => {
  const containerRef = useRef(null);
  const cytoRef = useRef(null);
 
    useEffect(() => {
  
      // Example event hook — a real controller would subscribe here
      const handleNodeTap = (evt) => {
        const node = evt.target;
        console.log("Node tapped:", node.id(), node.data("label"));
      };
      cytoRef.current.on("tap", "node", handleNodeTap);
  
      return () => {
        // Unbind explicitly (destroy() would also do this, but being
        // explicit avoids relying on ordering if this effect grows).
        cytoRef.current?.off("tap", "node", handleNodeTap);
        cytoRef.current?.destroy();
        cytoRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // init once; updates handled imperatively below

 
  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h2>Cytoscape Graph</h2>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => containerRef.current.fit()}>Fit</button>{" "}
        <button onClick={() => containerRef.current.runLayout("grid")}>
          Grid Layout
        </button>{" "}
        <button onClick={() => containerRef.current.runLayout("cose")}>
          Cose Layout
        </button>
      </div>
      <GraphView ref={containerRef} elements={initialElements} />
    </div>
  );
}
