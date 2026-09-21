import asyncio
import os
from pathlib import Path
from carthage import inject, Injector, AsyncInjector, ConfigLayout, InjectionKey
from carthage.config import ConfigSchema
from carthage.config.types import ConfigPath
from carthage.modeling import CarthageLayout
from . import layout
from .models import ModelStore
from .web_backend import start_web_server, web_server_key, web_app_key, build_web_app, pcap_dir_key


class ViperWhsConfig(ConfigSchema, prefix=""):
    pcap_dir: ConfigPath = "{vm_image_dir}/pcap"


@inject(injector=Injector)
def get_pcap_image_dir(injector):
    config = injector(ConfigLayout)
    path = Path(config.pcap_dir)
    os.makedirs(path, exist_ok=True)
    return path

@inject(injector=Injector)
def build_model_store(injector: Injector):
    config = injector(ConfigLayout)
    state_dir = Path(config.state_dir)
    return ModelStore(model_dir=state_dir/"model_store")


def _start_web_server(injector, loop):
    async def _start():
        ainjector = injector(AsyncInjector)
        await ainjector.get_instance_async(web_server_key)
    loop.create_task(_start())


@inject(injector=Injector)
def carthage_plugin(injector):
    injector.add_provider(InjectionKey(CarthageLayout), layout.build_layout)
    injector.add_provider(web_app_key, build_web_app)
    injector.add_provider(InjectionKey(ModelStore), build_model_store)
    injector.add_provider(web_server_key, start_web_server)
    injector.add_provider(pcap_dir_key, get_pcap_image_dir)
    # Plugins load on the base injector, the same one the loop is registered
    # on, so the loop_ready listener goes straight on injector.
    injector.add_event_listener(
        InjectionKey(asyncio.AbstractEventLoop),
        {'loop_ready'},
        lambda key, event, target, **kwargs: _start_web_server(injector, target))
    if injector.loop is not None:
        # Loop registered before this plugin loaded; the event already fired.
        _start_web_server(injector, injector.loop)
