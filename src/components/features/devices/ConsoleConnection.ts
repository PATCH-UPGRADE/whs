import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

export default class ConsoleConnection {
  consoleDiv: HTMLElement;
  term: Terminal;
  ws: WebSocket;
  termInternalDiv: HTMLElement;

  constructor(deviceId: string) {
    this.consoleDiv = document.getElementById("consoleScreen") as HTMLElement;
    this.term = new Terminal();
    this.term.open(this.consoleDiv);
    // this.termInternalDiv = document.getElementById("xterm-screen") as HTMLElement;

    // this.consoleDiv.style.width = this.termInternalDiv.style.width;
    // this.consoleDiv.style.height = this.termInternalDiv.style.height;

    const url = `ws://localhost:8080/api/v1/console_websocket/${deviceId}`;
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = (): void => {
      this.writeClientMessage("Connected to serial console");
      this.ws.send(new TextEncoder().encode("\r"));
    };

    this.ws.onclose = (event: CloseEvent): void => {
      if (event.wasClean) {
        this.writeClientMessage(`Disconnected (code ${event.code})`);
      } else {
        this.writeClientMessage(`Connection lost unexpectedly (code ${event.code})`);
      }
      if (event.reason) {
        this.writeClientMessage(`Reason: ${event.reason}`);
      }
    };

    this.ws.onerror = (): void => {
      this.writeClientMessage("Fatal Error");
    };

    this.ws.onmessage = (event: MessageEvent): void => {
      this.term.write(new Uint8Array(event.data));
    };

    this.term.onData((data: string): void => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(new TextEncoder().encode(data));
      }
    });
  }

  public dispose(): void {
    this.ws.close();
    this.term.dispose();
  }

  public writeClientMessage(message: string): void {
    this.term.write(`\r\n*** ${message} ***\r\n`);
  }
}
