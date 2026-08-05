import os
import socket
from types import SimpleNamespace

from fastapi.testclient import TestClient
from starlette.testclient import WebSocketDenialResponse

from carthage import InjectionKey
from carthage.modeling import MachineModel

from python import web_backend

'''
Web backend tests that tend to mock resources and do not require sudo to run.
Instantiating Carthage objects is fine, but causing Networks or Machines to be async_ready directly or indirectly is inappropriate for this series of tests.
'''


class FakeDomain:
    def __init__(self, backend_socket: socket.socket):
        self.backend_socket = backend_socket
        self.calls: list[tuple[int, int]] = []

    def openGraphicsFD(self, idx: int, flags: int = 0) -> int:
        self.calls.append((idx, flags))
        return os.dup(self.backend_socket.fileno())


class FakeLibvirtConnection:
    def __init__(self, domain: FakeDomain):
        self.domain = domain
        self.lookups: list[str] = []

    def lookupByName(self, name: str) -> FakeDomain:
        self.lookups.append(name)
        return self.domain


def test_vnc_websocket_proxies_bytes_for_seeded_device(app):
    backend_socket, peer_socket = socket.socketpair()
    backend_socket.settimeout(1.0)
    peer_socket.settimeout(1.0)
    fake_domain = FakeDomain(backend_socket)
    fake_conn = FakeLibvirtConnection(fake_domain)
    app.dependency_overrides[web_backend.get_libvirt_connection] = lambda: fake_conn
    client = TestClient(app)

    try:
        with client.websocket_connect("/api/v1/vnc_websocket/tester01", subprotocols=["binary"]) as websocket:
            websocket.send_bytes(b"client-to-vnc")
            assert peer_socket.recv(1024) == b"client-to-vnc"

            peer_socket.sendall(b"vnc-to-client")
            assert websocket.receive_bytes() == b"vnc-to-client"

        assert fake_conn.lookups == ["whs-tester01"]
        assert fake_domain.calls == [(0, web_backend.libvirt.VIR_DOMAIN_OPEN_GRAPHICS_SKIPAUTH)]
    finally:
        app.dependency_overrides.clear()
        backend_socket.close()
        peer_socket.close()


def test_vnc_websocket_missing_device_fails_handshake(app):
    client = TestClient(app)

    try:
        with client.websocket_connect("/api/v1/vnc_websocket/does-not-exist", subprotocols=["binary"]):
            raise AssertionError("websocket handshake unexpectedly succeeded")
    except WebSocketDenialResponse as exc:
        assert exc.status_code == 404
        assert exc.content == b'{"detail":"Device not found"}'


def test_models_import_merges_uploaded_yaml(app, model_store, monkeypatch):
    def discard_background_task(coro):
        coro.close()
        return None

    monkeypatch.setattr(web_backend.asyncio, "ensure_future", discard_background_task)
    client = TestClient(app)

    response = client.post(
        "/api/v1/models/import",
        files={
            "file": (
                "whs-models.yaml",
                """
vm_images:
  imported_vm:
    name: imported-image.qcow2
    description: Imported image
    version: "2026.06"
    type: qcow2
devices:
  imported_device:
    name: imported01
    description: Imported device
    type: vm
    vm_image:
      id: imported_vm
      name: imported-image.qcow2
      type: qcow2
""",
                "application/x-yaml",
            )
        },
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Success"}
    assert "imported_vm" in model_store.vm_images
    assert "imported_device" in model_store.devices
    assert model_store.devices["imported_device"].vm_image_id == "imported_vm"


def test_models_import_invalid_yaml_returns_400(app, monkeypatch):
    def discard_background_task(coro):
        coro.close()
        return None

    monkeypatch.setattr(web_backend.asyncio, "ensure_future", discard_background_task)
    client = TestClient(app)

    response = client.post(
        "/api/v1/models/import",
        files={
            "file": (
                "whs-models.yaml",
                "devices: []\n",
                "application/x-yaml",
            )
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Expected devices to be a mapping"


def test_models_import_regenerates_layout_with_new_machine(app, loop, monkeypatch):
    original_ensure_future = web_backend.asyncio.ensure_future

    def discard_background_task(coro):
        coro.close()
        return None

    monkeypatch.setattr(web_backend.asyncio, "ensure_future", discard_background_task)
    client = TestClient(app)

    response = client.post(
        "/api/v1/models/import",
        files={
            "file": (
                "whs-models.yaml",
                """
devices:
  imported_device:
    name: tester-import
    description: Imported device
    type: vm
    vm_image:
      id: debian_arm
      name: debian-13-nocloud-arm64.qcow2
      type: qcow2
""",
                "application/x-yaml",
            )
        },
    )

    assert response.status_code == 200
    monkeypatch.setattr(web_backend.asyncio, "ensure_future", original_ensure_future)

    loop.run_until_complete(web_backend.regenerate_layout(SimpleNamespace(app=app)))
    machine_keys = app.state.layout.injector.filter(MachineModel, ["host"])
    imported_machine_key = next(
        (
            key
            for key in machine_keys
            if key.constraints.get("host") in {"tester-import", "tester-import.whs.local"}
        ),
        None,
    )

    assert imported_machine_key is not None
    imported_machine = loop.run_until_complete(
        app.state.layout.ainjector.get_instance_async(
            imported_machine_key
        )
    )

    assert imported_machine.name == "tester-import"
