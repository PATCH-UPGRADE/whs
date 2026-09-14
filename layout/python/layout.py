import asyncio
import os
from carthage import *
import carthage.libvirt
from carthage.modeling import *
from carthage.podman import *
from carthage.oci import *
from carthage.network import V4Config, persistent_random_mac, NetworkConfig
from carthage.modeling import NetworkConfigModel, injector_access
from carthage.dependency_injection import inject, InjectionKey
from carthage_base import *
from .images import WhsRouter
from .models import ModelStore, VmImage
from .topology import build_routers, load_topology
from pathlib import Path
from typing import Optional


root_path = Path(__file__).parent.parent
assignments_path = root_path/"assignments.yml"

class AlreadyRunningMachine(Machine):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.running = True
    

@inject(device_model=InjectionKey('device_model'))
def build_v4_config(device_model) -> Optional[V4Config]:
    '''Build V4Config from device model, only setting non-falsy values.
    
    This function only sets v4_config attributes if the device model properties
    are non-falsy. Gateway and DNS servers are typically not set on devices
    (we don't want to override the V4Config in this case).
    
    dhcp is deprecated in the device model and is ignored here.
    '''
    if not device_model:
        return None
    
    kwargs = {}
    
    # Only set address if non-falsy
    if device_model.ipv4_manual:
        kwargs['address'] = str(device_model.ipv4_manual)
    
    # Only set gateway if non-falsy (typically not set on devices)
    if device_model.gateway:
        kwargs['gateway'] = str(device_model.gateway)
    
    # Only set dns_servers if non-empty
    if device_model.dns_servers:
        kwargs['dns_servers'] = tuple(str(s) for s in device_model.dns_servers)
    
    # Only create V4Config if we have static configuration
    if kwargs.get('address') or kwargs.get('gateway') or kwargs.get('dns_servers'):
        return V4Config(**kwargs)
    return None


@inject(
    device_model=InjectionKey('device_model'),
    injector=Injector,
)
def build_mac(interface, device_model, injector) -> Optional[str]:
    '''Use the user-defined MAC, or ask Carthage for a persistent random one.'''
    if device_model.mac_address:
        return device_model.mac_address
    return injector(persistent_random_mac, interface=interface)


@inject(device_model=InjectionKey('device_model'))
def build_dns_name(device_model) -> str:
    '''Build the fully qualified DNS name for a device.'''
    name = device_model.name
    return name if '.' in name else f'{name}.whs.local'


class DeviceNetworkConfig(NetworkConfigModel):
    add(
        'eth0', 
        mac=build_mac, 
        dns_name=build_dns_name, 
        v4_config=build_v4_config, 
        net=injector_access('default_network'),
        )


@inject(model_store=ModelStore, ainjector=AsyncInjector)
async def build_layout(model_store, ainjector) -> CarthageLayout:
    injector = ainjector.injector
    config = injector(ConfigLayout)
    model_store.load()
    model_store.validate_references()

    devices = model_store.devices.values()
    include_device_names = [d.name for d in devices if d.enabled_for_deployment]
    exclude_device_names = [d.name for d in devices if not d.enabled_for_deployment]
    os.environ['CARTHAGE_DEPLOY_INCLUDE'] = ' '.join(include_device_names)
    os.environ['CARTHAGE_DEPLOY_EXCLUDE'] = ' '.join(exclude_device_names)

    class layout(CarthageLayout):
        layout_name = 'whs'
        domain = 'whs.local'
        add_provider(podman_container_host, LocalPodmanContainerHost)
        add_provider(persistent_seed_path, assignments_path)
        add_provider(InjectionKey(NetworkConfig), DeviceNetworkConfig, allow_multiple=True)
        #: Define a WhsNetworkModel for each network of the current topology.
        injector(load_topology, locals())
        #: Register a RouterModel for each router of the current topology.
        injector(build_routers, locals())

        def build_container(device):
            device_name = device.name
            device_image = model_store.get_device_container_image(device)
            device_dns_servers = device.dns_servers or ('10.20.100.2',)
            device_dns_options = [f'--dns={server}' for server in device_dns_servers]

            if device_image is None:
                @inject()
                def container_image():
                    raise AttributeError(f"Device '{device_name}' has no container image set.")
            else:
                container_image = device_image.name

            @dynamic_name(device.name)
            class whs_container(MachineModel):
                device_model = device
                add_provider(machine_implementation_key, dependency_quote(PodmanContainer))
                add_provider(oci_container_image, container_image)
                name = device_name
                podman_options = [
                    *device_dns_options,
                    '--dns-search=whs.local',
                ]

            return whs_container

        def build_bare_metal(device):
            @dynamic_name(device.name)
            class whs_bare_metal(MachineModel):
                device_model = device
                name = device.name
                add_provider(machine_implementation_key, dependency_quote(BareMetalMachine))
                machine_mixins = (AlreadyRunningMachine,)

            return whs_bare_metal

        def build_vm(device):
            device_image = model_store.get_device_vm_image(device)
            image_dir = Path(config.vm_image_dir) / "images"
            if isinstance(device_image, VmImage) and not device_image.check_pending(image_dir, model_store):
                vm_image = dependency_quote(image_dir / device_image.name)
            else:
                missing_name = device_image.name if device_image else f'{device.name} image'

                @inject()
                def vm_image():
                    raise FileNotFoundError(f'VM image not present: {missing_name}')

            @dynamic_name(device.name) # TODO: Should we do something to prevent duplicate machine names?
            class whs_vm(MachineModel):
                device_model = device
                name = device.name
                architecture = device.architecture
                cloud_init = device.cloud_init
                cpus = device.cpus
                memory_mb = device.memory
                disk_config = [{'size': device.disk}]

                console_needed = 'vnc' if device.display==True else False
                add_provider(machine_implementation_key, dependency_quote(carthage.libvirt.Vm))
                add_provider(carthage.libvirt.vm_image_key, vm_image)

            return whs_vm

        for id, device in model_store.devices.items():
            if device.type == 'vm':
                new_vm = build_vm(device)
            elif device.type == 'container':
                new_container = build_container(device)
            elif device.type == 'bareMetal':
                new_bare_metal = build_bare_metal(device)

    return await ainjector(layout)
