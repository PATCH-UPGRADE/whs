import WebSocket from "ws";

Object.defineProperty(globalThis, "WebSocket", {
  configurable: true,
  writable: true,
  value: WebSocket,
});

Object.defineProperty(window, "WebSocket", {
  configurable: true,
  writable: true,
  value: WebSocket,
});
