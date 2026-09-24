import io
from pathlib import Path

from fastapi.testclient import TestClient
import yaml

from python.models import ContainerImage, Device, ModelStore, VmImage
from python.topology import RouterModel, load_topologies
from carthage.modeling import NetworkModel
from carthage.dependency_injection import InjectionKey, AsyncInjector

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
    layout.injector.get_instance(InjectionKey('bridge_net'))
    loop.run_until_complete(layout.resolve_networking())

    assert len(entanglement.all(WhsEntangledNetwork)) >= 1


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


def _registered_by_key(layout):
    '''Map InjectionKey -> generated model class for *layout*'s namespace.

    Reads the layout *class*'s ``__initial_injections__`` the same way the
    topology tests do (each entry maps an InjectionKey to ``(value,
    options)`` where *value* is, or wraps via ``dependency_quote``, a generated
    model class).  The *class* attribute is what ``load_topology`` /
    ``build_routers`` populate; the instance keeps its own per-instance copy
    for runtime keys, so ``type(layout)`` is read rather than *layout* itself.
    Only entries whose value is a generated model class are included.
    '''
    models = {}
    for key, (value, _opts) in type(layout).__initial_injections__.items():
        target = getattr(value, "value", value)
        if isinstance(target, type) and issubclass(target, (NetworkModel, RouterModel)):
            models[key] = target
    return models


def _default_network_name(layout):
    '''The name of the topology's default network as the layout registers it.

    ``load_topology`` registers the default network's model under the fixed
    ``default_network`` key (an alias of that network's own entry).  A network
    model has no class-level ``name`` attribute; ``@dynamic_name`` renames the
    class to the network's name, so the class's ``__name__`` is the name.
    '''
    model = _registered_by_key(layout)[InjectionKey('default_network')]
    return model.__name__


def test_build_layout_uses_current_topology_setting(loop, injector):
    '''build_layout picks the topology from model_store.settings.current_topology.

    The user selects a topology by changing the model store's settings and
    calling build_layout; the resulting layout uses that topology.  Both
    topologies in topology.yml are covered: the default 'Flat /24' and
    'Small Hospital'.

    This drives the real build_layout (via the layout provider the plugin
    registers) and reads the layout's default network back, so it verifies the
    build_layout -> load_topology -> build_routers path without deploying
    anything.  The default network's *identity* is what's checked (not every
    network's) so the test stays stable as topology.yml's networks change.

    ``build_layout`` is called directly with ``load_model_store=False`` (via
    ``ainjector(build_layout, ...)``) rather than through the injector's cached
    layout instance, so the in-memory setting is used without having to persist
    it, and each build reflects the current selection rather than a reused
    cached layout.  The layout's own injector is closed afterwards, as a
    directly-built layout claims one that the base injector would not tear down
    on its own.
    '''
    from python.layout import build_layout
    import conftest

    topologies = {t["name"]: t for t in load_topologies(conftest.layout_plugin)}
    ainjector = AsyncInjector(injector)

    for topology_name in ("Flat /24", "Small Hospital"):
        # Select the topology by mutating the model store, as the user would.
        model_store = injector.get_instance(InjectionKey(ModelStore))
        model_store.settings.current_topology = topology_name

        layout = loop.run_until_complete(
            ainjector(build_layout, load_model_store=False))

        try:
            # The layout must use the selected topology's default network.
            assert _default_network_name(layout) == topologies[topology_name]["default_network"], (
                f"{topology_name}: default network")
        finally:
            layout.injector.close()
