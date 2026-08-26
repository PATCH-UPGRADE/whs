from __future__ import annotations

import asyncio
import importlib
import os
import shutil
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI

PROJECT_ROOT = Path(__file__).resolve().parents[2]
TEST_VM_IMAGE_DIR_ENV = "WHS_TEST_VM_IMAGE_DIR"
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

LAYOUT_ROOT = PROJECT_ROOT / "layout"
if str(LAYOUT_ROOT) not in sys.path:
    sys.path.insert(0, str(LAYOUT_ROOT))


def _prepend_vendor_sys_paths() -> None:
    """Prepend vendored python packages to ``sys.path`` for host-side tests.

    The --develop CLI sets the container's ``PYTHONPATH`` to ``/carthage``
    plus each vendor mount's container path (see ``patch_whs.cli``); mirror
    that here by resolving each entry under ``<project>/vendor`` (symlinks
    to developer checkouts) and prepending it, so the ``carthage`` and
    ``entanglement`` imports below pick up the developer's copies.
    """
    vendor_dir = PROJECT_ROOT / "vendor"
    if not vendor_dir.is_dir():
        return
    for entry in sorted(vendor_dir.iterdir(), key=lambda p: p.name):
        if not entry.is_dir():
            continue
        path_str = str(entry.resolve())
        if path_str not in sys.path:
            sys.path.insert(0, path_str)


_prepend_vendor_sys_paths()

from carthage import AsyncInjector, ConfigLayout, base_injector, shutdown_injector
from carthage.dependency_injection import InjectionKey, dependency_quote
from carthage.modeling import CarthageLayout
from carthage.plugins import CarthagePlugin, load_plugin

base_injector(load_plugin, LAYOUT_ROOT)

layout_plugin = base_injector.get_instance(InjectionKey(CarthagePlugin, name="whs"))
plugin_package_name = layout_plugin.package.__name__
layout_module = importlib.import_module(f"{plugin_package_name}.layout")
models_module = importlib.import_module(f"{plugin_package_name}.models")
web_backend = importlib.import_module(f"{plugin_package_name}.web_backend")
dynamic_models = importlib.import_module(f"{plugin_package_name}.dynamic_models")
ModelStore = models_module.ModelStore
web_app_key = web_backend.web_app_key
web_server_key = web_backend.web_server_key

sys.modules.setdefault("python.layout", layout_module)
sys.modules.setdefault("python.models", models_module)
sys.modules.setdefault("python.web_backend", web_backend)
sys.modules.setdefault("python.dynamic_models", dynamic_models)

@pytest.fixture(scope="session")
def loop():
    event_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(event_loop)
    base_injector.add_provider(InjectionKey(asyncio.AbstractEventLoop), event_loop)
    yield event_loop
    event_loop.close()


@pytest.fixture(scope="session")
def modelstore_defaults_dir() -> Path:
    return Path(__file__).parent / "resources" / "modelstore"


@pytest.fixture
def state_dir(tmp_path: Path, modelstore_defaults_dir: Path) -> Path:
    state_dir = tmp_path / "state"
    model_store_dir = state_dir / "model_store"
    shutil.copytree(modelstore_defaults_dir, model_store_dir, dirs_exist_ok=True)
    return state_dir


@pytest.fixture
def injector(state_dir: Path):
    injector = base_injector.claim()
    config = injector(ConfigLayout)
    test_vm_image_dir = os.environ.get(TEST_VM_IMAGE_DIR_ENV)
    config.base_dir = str(state_dir.parent)
    config.state_dir = str(state_dir)
    config.cache_dir = str(Path(test_vm_image_dir) / "cache" if test_vm_image_dir else state_dir / "cache")
    config.log_dir = str(state_dir / "log")

    config.vm_image_dir = test_vm_image_dir or str(state_dir / "vm")
    config.pcap_dir = str(state_dir / "pcap")
    config.local_run_dir = str(state_dir)
    config.delete_volumes = True
    config.persist_local_networking = False

    model_store = ModelStore(model_dir=state_dir / "model_store").load()
    injector.add_provider(InjectionKey(CarthageLayout), layout_module.build_layout)
    injector.add_provider(InjectionKey(ModelStore), model_store)
    injector.add_provider(web_app_key, web_backend.build_web_app, replace=True)
    injector.add_provider(web_server_key, dependency_quote(None))
    return injector


@pytest.fixture
def ainjector(injector, loop):
    ainjector = injector(AsyncInjector)
    yield ainjector
    loop.run_until_complete(shutdown_injector(ainjector))


@pytest.fixture
def model_store(injector) -> ModelStore:
    return injector.get_instance(InjectionKey(ModelStore))


@pytest.fixture
def entanglement():
    """Expose what has been synchronized into the carthage entanglement registry.

    ``carthage.entanglement`` is loaded as a plugin at conftest import time
    (see ``carthage_plugin.yml``), which instruments the base injector and
    populates the module-level :data:`carthage_registry` as models are
    instantiated. This fixture wraps that registry so a test can query what has
    been synchronized for a given class/primary key without standing up a server.
    """
    from carthage.entanglement import carthage_registry

    class _Entanglement:
        def store(self, cls):
            """The :class:`~entanglement.memory.AbstractSyncStore` for *cls*."""
            return carthage_registry.store_for_class(cls)

        def all(self, cls):
            """All synchronized objects of type *cls* (its store's values)."""
            return list(carthage_registry.store_for_class(cls).values())

        def synchronized(self, cls, *keys):
            """Look up the synchronized object of type *cls* with primary key *keys*.

            Looks up the SyncStore for *cls*, computes the key from its
            ``sync_primary_keys``, and returns the stored object, or ``None`` if
            nothing was synchronized for that key. Works for any class in the
            registry, not just networks.
            """
            store = carthage_registry.store_for_class(cls)
            key = keys[0] if len(keys) == 1 else tuple(keys)
            try:
                return store[key]
            except KeyError:
                return None

    return _Entanglement()


@pytest.fixture
def layout(ainjector, loop):
    return loop.run_until_complete(ainjector.get_instance_async(CarthageLayout))


@pytest.fixture
def app(ainjector, loop):
    plugin = ainjector.injector.get_instance(InjectionKey(CarthagePlugin, name="whs"))
    dist_root = (plugin.resource_dir / "../dist").resolve()
    created_dist_root = not dist_root.exists()
    dist_root.mkdir(parents=True, exist_ok=True)
    app = asyncio.get_event_loop().run_until_complete(ainjector.get_instance_async(web_app_key))
    assert isinstance(app, FastAPI)
    yield app

    pending = [task for task in asyncio.all_tasks(loop) if not task.done()]
    for task in pending:
        task.cancel()
    if pending:
        loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
    if created_dist_root:
        try:
            dist_root.rmdir()
        except OSError:
            pass
