import asyncio

from fastapi import WebSocket
import libvirt

class SerialConsoleSession:

    def __init__(self, libvirt_connection, domain_name):
        self.domain_name = domain_name

        self.subscribers: set[WebSocket] = set()
        self.loop = asyncio.get_event_loop()

        domain = libvirt_connection.lookupByName(self.domain_name)
        self.stream = libvirt_connection.newStream(libvirt.VIR_STREAM_NONBLOCK)
        domain.openConsole(None, self.stream, libvirt.VIR_DOMAIN_CONSOLE_FORCE)

        self.stream.eventAddCallback(
            libvirt.VIR_STREAM_EVENT_READABLE | libvirt.VIR_STREAM_EVENT_ERROR | libvirt.VIR_STREAM_EVENT_HANGUP,
            self._on_receive_event,
            None,
        )

    def _on_receive_event(self, stream, events, opaque):
        self.loop.call_soon_threadsafe(asyncio.ensure_future, self._read_and_send_to_client_loop())

    async def _read_and_send_to_client_loop(self):
        while True:
            try:
                data = self.stream.recv(65536)
            except libvirt.libvirtError as e:
                print("console stream error:", e)
                await self.clear_subscribers()
                return

            if data == -2:
                return

            if not data:
                await self.clear_subscribers()
                return

            dead = []
            for ws in list(self.subscribers):
                try:
                    await ws.send_bytes(data)
                except Exception:
                    dead.append(ws)

            for ws in dead:
                self.subscribers.discard(ws)

    async def clear_subscribers(self):
        for ws in list(self.subscribers):
            try:
                await ws.close()
            except Exception:
                pass

        self.subscribers.clear()

    async def send_to_console(self, data: bytes):
        view = memoryview(data)
        while view:
            try:
                n = self.stream.send(bytes(view))
            except libvirt.libvirtError as e:
                print("console send error:", e)
                return

            if n == -2:
                continue

            view = view[n:]

    def close(self):
        try:
            self.stream.eventRemoveCallback()
        except Exception:
            pass

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
