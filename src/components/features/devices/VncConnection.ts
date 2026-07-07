import RFB from "@novnc/novnc/core/rfb.js";

export default class VncConnection {
  rfb: RFB;

  desktopNameElement: HTMLElement;
  statusElement: HTMLElement;
  rfbElement: HTMLElement;

  constructor(deviceId: string) {
    this.statusElement = document.getElementById("vncStatus") as HTMLElement;
    this.desktopNameElement = document.getElementById(
      "vncDesktopName",
    ) as HTMLElement;
    this.rfbElement = document.getElementById("vncScreen") as HTMLElement;

    if (!this.desktopNameElement || !this.statusElement || !this.rfbElement) {
      throw new Error("Required VNC HTML elements have not loaded in time");
    }

    // const host = this.readQueryVariable("host", window.location.hostname);
    // const port = this.readQueryVariable("port", window.location.port);
    // const password = this.readQueryVariable("password", "");
    // const path = this.readQueryVariable("path", "vnc_websocket");

    this.setStatus("Connecting...");

    // const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    // const url = `${protocol}://${host}:${port}/${path}`;
    const url = `ws://localhost:8080/api/v1/vnc_websocket/${deviceId}`;

    this.rfb = new RFB(this.rfbElement, url, {
      // credentials: { password },
    });

    this.rfb.addEventListener("connect", (e: unknown) => this.onConnect(e));
    this.rfb.addEventListener("disconnect", (e: unknown) =>
      this.onDisconnect(e),
    );
    // this.rfb.addEventListener("credentialsrequired", (e: unknown) => this.onCredentialsRequired(e));
    this.rfb.addEventListener("desktopname", (e: unknown) =>
      this.onDesktopName(e),
    );

    // this.rfb.viewOnly = this.readQueryVariable("view_only", "false");
    // this.rfb.scaleViewport = this.readQueryVariable("scale", "false");

    // document
    //   .getElementById("sendCtrlAltDel")
    //   ?.addEventListener("click", (e: unknown) => {
    //     this.sendCtrlAltDel();
    //   });
  }

  setStatus(newStatus: string) {
    this.statusElement.textContent = `Status: ${newStatus}`;
  }

  onConnect(_e: unknown) {
    this.setStatus(`Connected`);
  }

  onDisconnect(e: unknown) {
    // @ts-expect-error - NoVNC does not provide any Event type definitions
    if (e.detail.clean) {
      this.setStatus("Disconnected");
    } else {
      this.setStatus("Something went wrong - Connection closed!");
    }
  }

  // onCredentialsRequired(e: unknown) {
  //   const password = prompt("Password required:");
  //   this.rfb.sendCredentials({ password });
  // }

  onDesktopName(e: unknown) {
    // @ts-expect-error - NoVNC does not provide any Event type definitions
    this.desktopNameElement.textContent = `Desktop: ${e.detail.name}`;
  }

  // sendCtrlAltDel() {
  //   this.rfb.sendCtrlAltDel();
  // }

  readQueryVariable(name: string, defaultValue: string) {
    const re = new RegExp(`.*[?&]${name}=([^&#]*)`);
    const match = document.location.href.match(re);

    if (match) {
      return decodeURIComponent(match[1]);
    }

    return defaultValue;
  }
}
