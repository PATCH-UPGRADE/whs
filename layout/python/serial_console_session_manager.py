import asyncio

from fastapi import WebSocket
import libvirt
from abc import ABC, abstractmethod

class SerialConsoleSession(ABC):

    def __init__(self):
        self.subscribers: set[WebSocket] = set()

    async def broadcast(self, data: bytes) -> None:
        dead = []
        for ws in list(self.subscribers):
            try:
                await ws.send_bytes(data)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.subscribers.discard(ws)

    async def clear_subscribers(self) -> None:
        for ws in list(self.subscribers):
            try:
                await ws.close()
            except Exception:
                pass

        self.subscribers.clear()

    @abstractmethod
    async def start(self) -> None:
        raise NotImplementedError

    @abstractmethod
    async def send_to_console(self, data: bytes) -> None:
        raise NotImplementedError

    @abstractmethod
    def close(self) -> None:
        raise NotImplementedError

class VmSerialConsoleSession(SerialConsoleSession):

    def __init__(self, domain_name, context):
        self.subscribers: set[WebSocket] = set()
        self.loop = asyncio.get_event_loop()

        libvirt_connection = context.libvirt_connection
        domain = libvirt_connection.lookupByName(domain_name)
        self.stream = libvirt_connection.newStream(libvirt.VIR_STREAM_NONBLOCK)
        domain.openConsole(None, self.stream, libvirt.VIR_DOMAIN_CONSOLE_FORCE)

        self.stream.eventAddCallback(
            libvirt.VIR_STREAM_EVENT_READABLE | libvirt.VIR_STREAM_EVENT_ERROR | libvirt.VIR_STREAM_EVENT_HANGUP,
            self._on_receive_event,
            None,
        )

    async def start(self):
        return

    def _on_receive_event(self, stream, events, opaque):
        asyncio.run_coroutine_threadsafe(self._read_and_send_to_client_loop(), self.loop)

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

            await self.broadcast(data)

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

class ContainerSerialConsoleSession(SerialConsoleSession):

    def __init__(self, container_name, context):
        self.container_name = container_name

        self.subscribers: set = set()
        self.process: asyncio.subprocess.Process = None
        self.task: asyncio.Task = None

    async def start(self):
        self.process = await asyncio.create_subprocess_exec(
            "podman", "attach", "--sig-proxy=false", self.container_name,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        self.task = asyncio.create_task(self._read_and_send_to_client_loop())

    async def _read_and_send_to_client_loop(self):
        try:
            while True:
                data = await self.process.stdout.read(4096)

                if not data:
                    break

                await self.broadcast(data)
        finally:
            self.close()

    async def send_to_console(self, data: bytes):
        # TODO: guard against connection resets
        if self.process and self.process.stdin:
            self.process.stdin.write(data)
            await self.process.stdin.drain()

    def close(self):
        try:
            self.process.terminate()
        except Exception:
            pass

        try:
            self.task.cancel()
        except Exception:
            pass

class SerialConsoleSessionManager:
    sessions: dict[str, SerialConsoleSession] = {}
    sessions_lock = asyncio.Lock()

    async def get_or_create_session(self, device_name, device_type, context):
        async with self.sessions_lock:
            session = self.sessions.get(device_name)

            if session is not None:
                return session
            
            if device_type == 'vm':
                session = VmSerialConsoleSession(device_name, context)
            else:
                session = ContainerSerialConsoleSession(device_name, context)

            self.sessions[device_name] = session
            await session.start()
            return session

    def remove_session(self, device_name):
        self.container_sessions.pop(device_name, None)
