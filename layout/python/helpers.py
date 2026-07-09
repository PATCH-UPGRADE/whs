import asyncio

from fastapi import WebSocket
import libvirt

class SerialConsoleSession:
    WOULD_BLOCK_INTERVAL = 0.05

    def __init__(self, libvirt_connection, domain_name):
        self.libvirt_connection = libvirt_connection
        self.domain_name = domain_name

        self.subscribers: set[WebSocket] = set()
        self.receive_task: asyncio.Task | None = None

        domain = self.libvirt_connection.lookupByName(self.domain_name)
        self.stream = self.libvirt_connection.newStream(libvirt.VIR_STREAM_NONBLOCK)
        domain.openConsole(None, self.stream, libvirt.VIR_DOMAIN_CONSOLE_FORCE)

        self.receive_task = asyncio.create_task(self.receive_loop())

    async def open(self):
        domain = self.libvirt_connection.lookupByName(self.domain_name)
        self.stream = self.libvirt_connection.newStream(libvirt.VIR_STREAM_NONBLOCK)
        domain.openConsole(None, self.stream, libvirt.VIR_DOMAIN_CONSOLE_FORCE)

        self.receive_task = asyncio.create_task(self.receive_loop())

    async def receive_loop(self):
        try:
            while True:
                try:
                    data = self.stream.recv(65536)
                except libvirt.libvirtError as e:
                    print("console stream error:", e)
                    break

                # -2 means Would Block for Non-Blocking streams
                if data == -2:
                    await asyncio.sleep(self.WOULD_BLOCK_INTERVAL)
                    continue

                if not data:
                    break

                dead = []
                for ws in list(self.subscribers):
                    try:
                        await ws.send_bytes(data)
                    except Exception:
                        dead.append(ws)

                for ws in dead:
                    self.subscribers.discard(ws)
        finally:
            for ws in list(self.subscribers):
                try:
                    await ws.close()
                except Exception:
                    pass

            self.subscribers.clear()

    async def send(self, data: bytes):
        view = memoryview(data)
        while view:
            try:
                n = self.stream.send(bytes(view))
            except libvirt.libvirtError as e:
                print("console send error:", e)
                return

            if n == -2:
                await asyncio.sleep(self.WOULD_BLOCK_INTERVAL)
                continue

            view = view[n:]

    def close(self):
        if self.receive_task:
            self.receive_task.cancel()

        try:
            self.stream.abort()
        except Exception:
            pass

class SerialConsoleSessionManager:
    sessions: dict[str, SerialConsoleSession] = {}
    sessions_lock = asyncio.Lock()

    async def get_or_create_session(self, libvirt_connection, domain_name):
        async with self.sessions_lock:
            session = self.sessions.get(domain_name)

            if session is not None:
                return session
            
            session = SerialConsoleSession(libvirt_connection, domain_name)
            # await session.open()
            self.sessions[domain_name] = session
            return session
            
        
    def remove_session(self, domain_name):
        self.sessions.pop(domain_name, None)
