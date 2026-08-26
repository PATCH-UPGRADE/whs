import io
from pathlib import Path

from fastapi.testclient import TestClient
import yaml

from python.models import ContainerImage, Device, ModelStore, VmImage

'''
Unit tests that do not require setting up a fastapi server.
'''


def test_model_store_is_seeded(model_store):
    assert "tester01" in model_store.devices
    assert "sdr_img" in model_store.vm_images


def test_whs_network_model_synchronizes_into_registry(injector, loop, entanglement):
    # A minimal layout carrying just a WhsNetworkModel is enough to exercise the
    # carthage entanglement instrumentation: instantiating the layout and
    # resolving its networking produces the network model, which fires the
    # instrumentation callback and stores a WhsEntangledNetwork in the registry.
    # (The full whs layout is not used here because bringing it to ready cascades
    # into machine/podman instantiation, which is outside a smoke test's scope.)
    from carthage.dependency_injection import InjectionKey
    from carthage.modeling import CarthageLayout, provides
    from carthage.network import V4Config
    from python.dynamic_models import WhsNetworkModel, WhsEntangledNetwork

    class whs_layout(CarthageLayout):
        layout_name = "whs"
        domain = "whs.local"

        @provides('bridge_net')
        class net(WhsNetworkModel):
            v4_config = V4Config(
                network='10.20.100.0/24',
                dhcp=False,
                pool=('10.20.100.10', '10.20.100.200'),
                gateway='10.20.100.1',
            )

    layout = whs_layout(injector=injector)
    net = layout.injector.get_instance(InjectionKey('bridge_net'))
    loop.run_until_complete(layout.resolve_networking())

    synced = entanglement.synchronized(WhsEntangledNetwork, "net")
    assert isinstance(synced, WhsEntangledNetwork)
    assert synced.name == "net"
    assert synced.network == "10.20.100.0/24"
    assert synced.injector_id == id(net.injector)


def test_app_reads_seeded_devices(app, model_store, state_dir: Path):
    client = TestClient(app)

    response = client.get("/api/v1/devices")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 2
    assert payload[0]["id"] == "tester01"
    assert (state_dir / "model_store" / "devices.yml").exists()


def test_model_store_saves_into_temp_state_dir(model_store, state_dir: Path):
    device = Device(
        id="tester03",
        name="tester03",
        description="Third test device",
    )
    model_store.store_synchronize(device)
    model_store.save()

    saved = (state_dir / "model_store" / "devices.yml").read_text()
    assert "tester03" in saved


def test_vm_image_check_pending_updates_and_saves(model_store, state_dir: Path):
    image = model_store.vm_images["debian_arm"]
    image_dir = state_dir / "vm" / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    (image_dir / image.name).write_bytes(b"image")

    assert image.check_pending(image_dir, model_store) is False
    assert model_store.vm_images["debian_arm"].pending is False
    assert "pending: false" in (state_dir / "model_store" / "vm_images.yml").read_text()


def _add_container_export_data(model_store):
    image = ContainerImage(
        id="nginx_latest",
        name="nginx:latest",
        description="Nginx test image",
        version='',
    )
    device = Device(
        id="container01",
        name="container01",
        description="Container test device",
        type="container",
        container_image_id=image.id,
    )
    model_store.store_synchronize(image)
    model_store.store_synchronize(device)


def test_model_store_export_yaml_matches_regression_fixture(model_store):
    _add_container_export_data(model_store)
    exported = yaml.safe_load(model_store.export_yaml())
    expected = yaml.safe_load(Path("tests/resources/modelstore_export.yml").read_text())

    assert exported == expected


def test_model_store_import_yaml_round_trips_and_merges_existing_data(model_store):
    _add_container_export_data(model_store)
    exported = model_store.export_yaml()
    extra_device = Device(
        id="tester03",
        name="tester03",
        description="Third test device",
    )
    imported_store = ModelStore()
    imported_store.store_synchronize(extra_device)

    imported_store.import_yaml(exported)
    round_tripped = yaml.safe_load(imported_store.export_yaml())

    assert imported_store.devices["tester01"].vm_image_id == "debian_arm"
    container01 = imported_store.devices["container01"]
    assert container01.type == "container"
    assert imported_store.devices["tester03"] == extra_device
    assert imported_store.get_device_container_image(container01).name == "nginx:latest"
    assert "container_images" not in round_tripped
    assert isinstance(round_tripped["devices"], dict)
    assert set(round_tripped["devices"]) == {"tester01", "tester02", "tester03", "container01"}
    assert "id" not in round_tripped["devices"]["tester01"]
    assert round_tripped["devices"]["container01"]["container_image"] == "nginx:latest"


def test_model_store_import_yaml_synthesizes_missing_vm_image():
    imported_store = ModelStore()

    imported_store.import_yaml(
        """
devices:
  tester03:
    name: tester03
    description: Third test device
    type: vm
    vm_image:
      id: imported_vm
      name: imported.qcow2
      type: qcow2
pcaps: {}
vm_images: {}
"""
    )

    assert imported_store.devices["tester03"].vm_image_id == "imported_vm"
    assert imported_store.vm_images["imported_vm"].name == "imported.qcow2"
    assert imported_store.vm_images["imported_vm"].type == "qcow2"


def test_model_store_import_yaml_ignores_pending_for_new_vm_images():
    imported_store = ModelStore()

    imported_store.import_yaml(
        """
vm_images:
  imported_vm:
    name: imported.qcow2
    description: Imported image
    version: "v1"
    type: qcow2
    pending: false
devices: {}
pcaps: {}
"""
    )

    assert imported_store.vm_images["imported_vm"].pending is True


def test_upload_image_reuses_pending_vm_image(app, model_store):
    pending_image = VmImage(
        id="pending_vm",
        name="upload-test.qcow2",
        description="Imported placeholder",
        version="v0",
        type="qcow2",
        pending=True,
    )
    model_store.store_synchronize(pending_image)
    client = TestClient(app)

    response = client.post(
        "/api/v1/images/upload",
        data={"description": "Uploaded image", "version": "v1"},
        files={"file": ("upload-test.qcow2", io.BytesIO(b"image-bytes"), "application/octet-stream")},
    )

    assert response.status_code == 200
    assert model_store.vm_images["pending_vm"].pending is False
    assert model_store.vm_images["pending_vm"].description == "Uploaded image"
    assert model_store.vm_images["pending_vm"].version == "v1"


def test_upload_image_rejects_existing_non_pending_vm_image(app, model_store):
    existing_image = VmImage(
        id="existing_vm",
        name="existing-test.qcow2",
        description="Existing image",
        version="v1",
        type="qcow2",
        pending=False,
    )
    model_store.store_synchronize(existing_image)
    client = TestClient(app)

    response = client.post(
        "/api/v1/images/upload",
        data={"description": "Uploaded image", "version": "v2"},
        files={"file": ("existing-test.qcow2", io.BytesIO(b"image-bytes"), "application/octet-stream")},
    )

    assert response.status_code == 400
