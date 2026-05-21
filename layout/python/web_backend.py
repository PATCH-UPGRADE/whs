from __future__ import annotations

import asyncio
import socket
import os
from pathlib import Path
import shutil
import struct
from typing import Annotated, get_args
from fastapi.responses import JSONResponse
import uvicorn
import libvirt
from fastapi import FastAPI, APIRouter, Depends, Form, HTTPException, Request, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from starlette.requests import HTTPConnection
from carthage import (
    AsyncInjector,
    ConfigLayout,
    base_injector,
    Injector,
    inject,
    InjectionKey,
    CarthagePlugin,
    deployment)
from carthage.modeling import CarthageLayout
from carthage.dependency_injection import instantiation_roots
from .models import *
from .dynamic_models import FrontendDeploymentResult, map_deployment_result
from starlette.exceptions import HTTPException as StarletteHTTPException

def get_ainjector(connection: HTTPConnection)->AsyncInjector:
    return connection.app.state.layout.ainjector

def get_layout(connection: HTTPConnection)-> CarthageLayout:
    return connection.app.state.layout

def get_model_store(connection: HTTPConnection)->ModelStore:
    return connection.app.state.model_store

def get_libvirt_connection():
    conn = libvirt.open('')
    if conn is None:
        raise HTTPException(status_code=500, detail="Unable to open default libvirt connection")
    try:
        yield conn
    finally:
        conn.close()

def running_deployment()-> deployment.DeploymentResult | None:
    for r in instantiation_roots:
        if isinstance(r, deployment.DeploymentIntrospection):
            return r.result
    return None


ainjector_dependency = Annotated[AsyncInjector, Depends(get_ainjector)]

layout_dependency = Annotated[CarthageLayout, Depends(get_layout)]

model_store_dependency = Annotated[ModelStore, Depends(get_model_store)]
libvirt_connection_dependency = Annotated[libvirt.virConnect, Depends(get_libvirt_connection)]
                                   
async def regenerate_layout(request:Request):
    '''
    Backgrount task to update the layout after mutations to the ModelStore.
    Scheduled as  asyncio.ensure_future(regenerate_layout()
    Only allows one regeneration to be pending at a time.
    '''
    state = request.app.state
    injector = request.app.state.base_injector
    if state.regeneration_task:
        return
    state.regeneration_task = asyncio.current_task()
    async with state.deployment_lock:
        state.regeneration_task = None
        from .layout import build_layout
        injector.replace_provider(InjectionKey(CarthageLayout), build_layout)
        ainjector = AsyncInjector(injector)
        state.layout = await ainjector.get_instance_async(CarthageLayout)




api_v1 = APIRouter(prefix="/api/v1")

@api_v1.get("/devices")
async def get_devices(model_store:model_store_dependency)-> list[Device]:
    return list(model_store.devices.values())

@api_v1.post('/devices')
async def create_device(device:Device, request:Request, model_store:model_store_dependency):
    model_store.devices[device.id] = device
    model_store.save()
    asyncio.ensure_future(regenerate_layout(request))

@api_v1.put('/devices/{device_id}')
async def update_device(device_id:str, device:Device, request:Request, model_store:model_store_dependency):
    if not device_id in model_store.devices:
        raise HTTPException(status_code=404, detail="Device not found")

    model_store.devices[device_id] = device
    model_store.save()
    asyncio.ensure_future(regenerate_layout(request))

@api_v1.delete('/devices/{device_id}')
async def delete_device(device_id:str, request:Request, model_store:model_store_dependency):
    if not device_id in model_store.devices:
        raise HTTPException(status_code=404, detail="Device not found")

    model_store.devices.pop(device_id)
    model_store.save()
    asyncio.ensure_future(regenerate_layout(request))

@api_v1.post('/deploy')
async def run_deployment(request:Request, layout:layout_dependency):
    '''
    Start a deployment of the current layout.
    '''
    async def deployment_task():
        async with state.deployment_lock:
            ainjector = layout.ainjector
            state.deployables = await ainjector(
                deployment.find_deployables)
            state.deployment_result = await ainjector(
                deployment.run_deployment, deployables=state.deployables)
            
    state = request.app.state
    if state.deployment_lock.locked():
        raise HTTPException(status_code=409, detail="deployment running")
    state.deployment_result = None
    asyncio.ensure_future(deployment_task())

@api_v1.get('/deployment-status')
async def deployment_status(request: Request) -> FrontendDeploymentResult | None:
    result = running_deployment()
    if result is None:
        result = request.app.state.deployment_result
        if result is None:
            return None
        return map_deployment_result(result)
    return map_deployment_result(result, running=True)

web_server_key = InjectionKey('viper_whs.webserver')
web_app_key = InjectionKey('viper_whs.app')
@api_v1.get("/images")
async def get_images(model_store:model_store_dependency)-> list[VmImage]:
    return list(model_store.vm_images.values())

@api_v1.post("/images/upload")
async def upload_image(request:Request, model_store:model_store_dependency, file: UploadFile = File(...), description: str = Form(...), version: str = Form(...), )-> str:
    filename = file.filename

    # splitext returns ['name', '.ext'] but we want the ext without the dot
    extension = os.path.splitext(filename)[1][1:].lower()
    if not extension in get_args(VmImage.model_fields['type'].annotation):
        raise HTTPException(status_code=400, detail=f"Invalid extension type. Supported extensions are [{VmImage.type}]")

    image_model = VmImage(name=filename, type=extension, description=description, version=version)

    config = await get_ainjector(request)(ConfigLayout)
    vm_image_path = f"{config.vm_image_dir}/images"
    os.makedirs(vm_image_path, exist_ok=True)
    file_path = f"{vm_image_path}/{filename}"

    try:
        with open(file_path, 'wb') as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception:
        raise HTTPException(status_code=500, detail="Something went wrong!")
    finally:
        await file.close()

    model_store.vm_images[image_model.id] = image_model
    model_store.save()

    return JSONResponse(content = {
        "message": "Success",
    })

@api_v1.get("/pcaps")
async def get_pcaps(model_store:model_store_dependency)-> list[Pcap]:
    return list(model_store.pcaps.values())

@api_v1.delete('/pcaps/{pcap_id}')
async def delete_pcap(pcap_id:str, model_store:model_store_dependency):
    if not pcap_id in model_store.pcaps:
        raise HTTPException(status_code=404, detail="PCAP not found")

    model_store.pcaps.pop(pcap_id)
    model_store.save()

PCAP_MAGIC_BYTES = [
    b'\xa1\xb2\xc3\xd4',
    b'\xa1\xb2\x3c\x4d',
    b'\xd4\xc3\xb2\xa1',
    b'\x4d\x3c\xb2\xa1',
]

PCAPNG_MAGIC_BYTES = [
    0x0A0D0D0A,
    0x4D3C2B1A,
    0x1A2B3C4D,
]

pcap_dir_key = InjectionKey('viper_whs.pcap_dir')
@api_v1.post("/pcaps/upload")
async def upload_pcap(request:Request, model_store:model_store_dependency, file: UploadFile = File(...), description: str = Form(...)):
    # read first 4 bytes then reset pointer
    header = await file.read(28)
    await file.seek(0)

    if len(header) < 4:
        raise HTTPException(
            status_code=400, 
            detail="Too small to be a valid file"
        )

    magic_bytes = header[:4]
    block_type = struct.unpack(">I", magic_bytes)[0]

    # determine pcap type
    if block_type == PCAPNG_MAGIC_BYTES[0]:
        file_type = "pcapng"
    elif magic_bytes in (PCAP_MAGIC_BYTES[0], PCAP_MAGIC_BYTES[1]):
        endian = ">"
        file_type = "pcap"
    elif magic_bytes in (PCAP_MAGIC_BYTES[2], PCAP_MAGIC_BYTES[3]):
        endian = "<"
        file_type = "pcap"
    else:
        raise HTTPException(
            status_code=400, 
            detail="Invalid file format. Not a valid .pcap or .pcapng file."
        )

    # validate the pcap type
    if file_type == "pcap":
        if len(header) < 24:
            raise HTTPException(
                status_code=400, 
                detail="Header number of bytes too small to be a valid .pcap file"
            )

        major, minor, _, _, snaplen, network = struct.unpack(f"{endian}HHiIII", header[4:24])

        if major != 2 and minor != 4:
            raise HTTPException(
                status_code=400,
                detail=f"Unexpected .pcap version found [v{major}.{minor}] expected v2.4"
            )
        # 262_144 is common max size for snaplen per google search
        if snaplen <= 0 or snaplen >= 262_144:
            raise HTTPException(
                status_code=400, 
                detail=f"Unexpected snaplen value of [{snaplen}]"
            )
        if network <= 0 or network > 65535:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid network value of [{network}]"
            )

    elif file_type == "pcapng":
        if len(header) < 28:
            raise HTTPException(
                status_code=400, 
                detail="Header number of bytes too small to be a valid .pcapng file"
            )

        bom = struct.unpack(">I", header[8:12])[0]
        if bom == PCAPNG_MAGIC_BYTES[0]:
            endian = ">"
        elif bom == PCAPNG_MAGIC_BYTES[1]:
            endian = "<"
        else:
            raise HTTPException(
                status_code=400, 
                detail="Invalid file format. Not a valid .pcapng file."
            )

        block_len = struct.unpack(f"{endian}I", header[4:8])[0]
        if block_len < 28:
            raise HTTPException(
                status_code=400, 
                detail="Header number of bytes too small to be a valid .pcapng file"
            )

        major, minor = struct.unpack(f"{endian}HH", header[12:16])
        if major != 1 or minor != 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Unexpected .pcapng file version found [v{major}.{minor}]"
            )
    else:
        raise HTTPException(
            status_code=400, 
            detail=f"Could not determine if correct .pcap / .pcapng from header"
        )

    filename = file.filename
    pcap_model = Pcap(name=filename, description=description)

    injector = get_ainjector(request)
    pcap_file_dir = injector.get_instance(pcap_dir_key)
    file_path = f"{pcap_file_dir}/{filename}"

    try:
        with open(file_path, 'wb') as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Something went wrong trying to write .pcap file to disk!")
    finally:
        await file.close()

    model_store.pcaps[pcap_model.id] = pcap_model
    model_store.save()

    return JSONResponse(content = {
        "message": "Success",
    })

class SinglePageApplicationStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        # try and get path, if it fails return index.html so SPA routing works in prod
        try:
            return await super().get_response(path, scope)
        except (StarletteHTTPException, Exception) as ex:
            if getattr(ex, "status_code", None) == 404:
                return await super().get_response("index.html", scope)
            raise ex

@api_v1.websocket("/vnc_websocket/{device_id}")
async def vnc_websocket_proxy(
    ws: WebSocket,
    device_id: str,
    model_store: model_store_dependency,
    libvirt_connection: libvirt_connection_dependency,
):
    device = model_store.devices.get(device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    requested = ws.headers.get("sec-websocket-protocol")
    subprotocol = requested.split(",")[0].strip() if requested else None
    await ws.accept(subprotocol=subprotocol)

    if device.type != 'vm':
        await ws.close(code=1008, reason="Only VM devices support VNC")
        return

    domain_name = f"whs-{device.name}"
    try:
        domain = libvirt_connection.lookupByName(domain_name)
        graphics_fd = domain.openGraphicsFD(0, libvirt.VIR_DOMAIN_OPEN_GRAPHICS_SKIPAUTH)
        vnc_socket = socket.socket(fileno=graphics_fd)
        vnc_socket.setblocking(False)
        reader, writer = await asyncio.open_connection(sock=vnc_socket)
    except (libvirt.libvirtError, OSError) as e:
        print("ERROR", e)
        await ws.close(code=1011)
        return

    async def ws_to_vnc():
        try:
            while True:
                data = await ws.receive_bytes()
                writer.write(data)
                await writer.drain()
        except WebSocketDisconnect:
            print("Websocket Client disconnected")
        except Exception:
            writer.close()
    
    async def vnc_to_ws():
        try:
            while True:
                data = await reader.read(65536)
                if not data:
                    break
                await ws.send_bytes(data)
        except Exception as e:
            print("vnc_to_ws() error:", e)
        
        try:
            await ws.close()
        except Exception:
            pass

    done, pending = await asyncio.wait([
        asyncio.create_task(ws_to_vnc(), name="ws-to-vnc"),
        asyncio.create_task(vnc_to_ws(), name="vnc-to-ws")
    ], return_when=asyncio.FIRST_COMPLETED)

    for task in pending:
        task.cancel()
    writer.close()
    try:
        await writer.wait_closed()
    except Exception:
        pass
    print("Session closed")

@inject(
    layout=InjectionKey(CarthageLayout, _ready=False),
    plugin=InjectionKey(CarthagePlugin, name='whs'),
    injector=Injector)
async def build_web_app(layout, plugin, injector):
    app = FastAPI()
    app.state.layout = layout
    #: This lock should be held while calling run_deploy or run_deployment_destroy or regenerating the layout. In general  frontend should return 409 rather than blocking on this lock. The only thing that should block on this lock is a background replace of the layout.
    app.state.deployment_lock = asyncio.Lock()
    app.state.deployment_result = None
    #: The task of a layout regeneration that has not yet started. If
    #a model change is made and this is non-None, no regeneration
    #needs to be queued. This should be cleared in the regeneration
    #task after the lock is obtained but before the ModelStore is read
    #by the new layout so that future changes will force a new
    #regeneration.
    app.state.regeneration_task = None
    app.state.injector = injector
    app.state.base_injector = injector
    app.state.model_store = injector.get_instance(ModelStore)
    app.include_router(api_v1)

    if (plugin.resource_dir/'../dist').exists():
        app.mount('/', SinglePageApplicationStaticFiles(directory=plugin.resource_dir/'../dist', html=True), name='frontend')
        return app

@inject(app=web_app_key)
async def start_web_server(app):
    config = uvicorn.Config(app,
                             port=int(os.environ.get('PORT', 8080)),
                             host='0.0.0.0',
                            )
    server = uvicorn.Server(config)
    asyncio.get_event_loop().create_task(server.serve())
