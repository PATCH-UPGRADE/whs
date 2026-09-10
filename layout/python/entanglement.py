import asyncio
import random

from carthage.entanglement import carthage_registry
from carthage.entanglement.instrumentation import CarthageDestination
from entanglement.filter import Filter
from entanglement.network import SyncServer
from entanglement.websocket import fastapi_entanglement_loop
from .models import ModelStore

from fastapi import FastAPI, WebSocket


def setup_entanglement(app: FastAPI, model_store: ModelStore) -> None:
    """
    Set up entanglement for the FastAPI app.

    Creates a SyncServer with the ModelStore and the carthage entanglement
    registry and stores it in app.state.entanglement_manager for use by the
    websocket handler.
    """
    loop = asyncio.get_running_loop()

    manager = SyncServer(cert=None, port=0,
                         registries=[model_store, carthage_registry],
                         loop=loop)
    app.state.entanglement_manager = manager


class WhsEntanglementDestination(CarthageDestination):

    '''A sync destination for the WHS web app.

    Subclasses :class:`CarthageDestination` so it inherits the
    ``carthage_registry`` filter, and adds a filter for the WHS
    ``ModelStore`` instance.  Together the filters determine both which
    objects may be sent to a connection (``should_send``) and which
    objects are flooded on connect (``all_objects``), so callers do not
    have to enumerate model classes.
    '''

    def __init__(self, model_store, name=None):
        super().__init__()
        self.name = name or f'whs ws {random.randbytes(4).hex()}'
        self.add_filter(Filter(lambda o: True, registry=model_store))


def _sync_registry_owner(manager, registry, destination):
    '''Synchronize the local owner of *registry* to *destination*.

    The owner is a member of both registries' ``stores_by_class`` and is
    therefore already flooded by the destination's filters, but
    synchronizing it explicitly on connect is harmless and makes the
    ownership state visible immediately.
    '''
    manager.synchronize(registry.local_owner, destinations=[destination])


async def entanglement_websocket(websocket: WebSocket):
    """
    FastAPI websocket handler for entanglement synchronization.

    Each connection gets its own destination since destinations have a
    1:1 relationship with websocket connections.  The destination's
    filters (carthage_registry and ModelStore) drive both the initial
    object flood on connect and which updates are subsequently sent,
    including WhsEntangledNetwork entries for the layout's networks.
    """
    manager = websocket.app.state.entanglement_manager
    model_store = websocket.app.state.model_store
    destination = WhsEntanglementDestination(model_store, name=f"ws-{id(websocket)}")

    def on_connect():
        _sync_registry_owner(manager, model_store, destination)
        _sync_registry_owner(manager, carthage_registry, destination)

    destination.on_connect(on_connect)

    await fastapi_entanglement_loop(websocket, destination, manager=manager)
