from pathlib import Path

from fastapi.testclient import TestClient
import yaml

from python.models import ContainerImage, Device, ModelStore


def test_model_store_is_seeded(model_store):
    assert "tester01" in model_store.devices
    assert "sdr_img" in model_store.vm_images


def test_app_reads_seeded_devices(app, model_store, state_dir: Path):
    client = TestClient(app)

    response = client.get("/api/v1/devices")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == "tester01"
    assert (state_dir / "model_store" / "devices.yml").exists()


def test_model_store_saves_into_temp_state_dir(model_store, state_dir: Path):
    device = Device(
        id="tester02",
        name="tester02",
        description="Second test device",
    )
    model_store.devices[device.id] = device
    model_store.save()

    saved = (state_dir / "model_store" / "devices.yml").read_text()
    assert "tester02" in saved


def _add_container_export_data(model_store):
    image = ContainerImage(
        id="nginx_latest",
        name="nginx:latest",
        description="Nginx test image",
        version=1.0,
    )
    device = Device(
        id="container01",
        name="container01",
        description="Container test device",
        type="container",
        image_id=image.id,
    )
    model_store.container_images[image.id] = image
    model_store.devices[device.id] = device


def test_model_store_export_yaml_matches_regression_fixture(model_store):
    _add_container_export_data(model_store)
    exported = model_store.export_yaml()
    expected = Path("tests/resources/modelstore_export.yml").read_text()

    assert exported == expected


def test_model_store_import_yaml_round_trips_and_merges_existing_data(model_store):
    _add_container_export_data(model_store)
    exported = model_store.export_yaml()
    extra_device = Device(
        id="tester02",
        name="tester02",
        description="Second test device",
    )
    imported_store = ModelStore()
    imported_store.devices[extra_device.id] = extra_device

    imported_store.import_yaml(exported)
    round_tripped = yaml.safe_load(imported_store.export_yaml())

    assert imported_store.devices["tester01"].image_id == "debian_arm"
    container01 = imported_store.devices["container01"]
    assert container01.type == "container"
    assert imported_store.devices["tester02"] == extra_device
    assert imported_store.get_device_image(container01).name == "nginx:latest"
    assert "container_images" not in round_tripped
    assert isinstance(round_tripped["devices"], dict)
    assert set(round_tripped["devices"]) == {"tester01", "tester02", "container01"}
    assert "id" not in round_tripped["devices"]["tester01"]
    assert round_tripped["devices"]["container01"]["image"] == "nginx:latest"
