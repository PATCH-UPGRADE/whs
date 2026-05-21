import os
from pathlib import Path
from carthage import inject, Injector, ConfigLayout, InjectionKey
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

@inject(injector=Injector)
def carthage_plugin(injector):
    injector.add_provider(InjectionKey(CarthageLayout), layout.build_layout)
    injector.add_provider(web_app_key, build_web_app)
    injector.add_provider(InjectionKey(ModelStore), build_model_store)
    injector.add_provider(web_server_key, start_web_server)
    injector.add_provider(pcap_dir_key, get_pcap_image_dir)
