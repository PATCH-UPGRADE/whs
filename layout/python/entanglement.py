import asyncio
import random
from entanglement.websocket import fastapi_entanglement_loop
from entanglement.network import SyncDestination, SyncServer
from .models import ModelStore, Device, VmImage, Pcap

from fastapi import FastAPI, WebSocket


def setup_entanglement(app: FastAPI, model_store: ModelStore) -> None:
    """
    Set up entanglement for the FastAPI app.
    
    Creates a SyncManager with the ModelStore as a registry and stores it in
    app.state.entanglement_manager for use by the websocket handler.
    """
    loop = asyncio.get_running_loop()
    
    manager = SyncServer(cert=None, port=0, registries=[model_store], loop=loop)
    app.state.entanglement_manager = manager


async def entanglement_websocket(websocket: WebSocket):
    """
    FastAPI websocket handler for entanglement synchronization.
    
    Uses FastAPI's dependency injection to get the app via websocket.app.
    Each connection gets its own SyncDestination since SyncDestination/SyncProtocolBase
    have a 1:1 relationship. On connect, synchronizes all Devices, VmImages, and Pcaps.
    """
    manager = websocket.app.state.entanglement_manager
    
    destination = SyncDestination(name=f"ws-{id(websocket)}", dest_hash=random.randbytes(32))
    model_store = websocket.app.state.model_store
    
    def on_connect():
        manager.synchronize(model_store.local_owner, destinations=[destination])
        for device in model_store.devices.values():
            manager.synchronize(device, destinations=[destination])
        for vm_image in model_store.vm_images.values():
            manager.synchronize(vm_image, destinations=[destination])
        for pcap in model_store.pcaps.values():
            manager.synchronize(pcap, destinations=[destination])
    
    destination.on_connect(on_connect)
    
    await fastapi_entanglement_loop(websocket, destination, manager=manager)
