import asyncio
from carthage import *
import carthage.libvirt
from carthage.modeling import *
from carthage.podman import *
from carthage.oci import *
from carthage.network import V4Config, persistent_random_mac, NetworkConfig
from carthage.systemd import SystemdNetworkModelMixin
from carthage.modeling import NetworkConfigModel, injector_access
from carthage.dependency_injection import inject, InjectionKey
from carthage_base import *
from .images import WhsRouter
from .web_backend import web_server_key
from .models import ModelStore, VmImage
from pathlib import Path
from typing import Optional


root_path = Path(__file__).parent.parent
assignments_path = root_path/"assignments.yml"


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


@inject(device_model=InjectionKey('device_model'))
def build_mac(device_model) -> str:
    '''Build MAC address from device model.'''
    if device_model.mac_address:
        return device_model.mac_address
    return persistent_random_mac


class DeviceNetworkConfig(NetworkConfigModel):
    add('eth0', mac=build_mac, v4_config=build_v4_config, net=injector_access('bridge_net'))


@inject(model_store=ModelStore, ainjector=AsyncInjector)
async def build_layout(model_store, ainjector) -> CarthageLayout:
    injector = ainjector.injector
    config = injector(ConfigLayout)
    model_store.load()
    model_store.validate_references()
    asyncio.ensure_future(ainjector.get_instance_async(web_server_key))

    class layout(CarthageLayout):
        layout_name = 'whs'
        domain = 'whs.local'
        from .images import WhsRouter
        add_provider(podman_container_host, LocalPodmanContainerHost)
        add_provider(persistent_seed_path, assignments_path)
        add_provider(MachineDependency(f'router.{domain}'))
        add_provider(InjectionKey(NetworkConfig), DeviceNetworkConfig, allow_multiple=True)

        @provides('bridge_net')
        class net(NetworkModel):
            bridge_name = 'whs-lab'
            podman_bridge_name = 'whs-lab'
            podman_unmanaged = True
            podman_container_dns = True
            v4_config = V4Config(
                network='10.20.100.0/24',
                dhcp=False,
                pool=('10.20.100.10', '10.20.100.200'),
                domains='whs.local',
                dns_servers=('10.20.100.2',),
                gateway='10.20.100.1',
            )
        
        class net_config(NetworkConfigModel):
            add('eth0', mac=persistent_random_mac, 
                net=injector_access('bridge_net'), 
                v4_config=V4Config(dhcp=True))
            
        class router(DhcpRole, SystemdNetworkModelMixin, MachineModel):
            override_dependencies = True
            add_provider(machine_implementation_key, dependency_quote(PodmanContainer))
            add_provider(oci_container_image, injector_access(WhsRouter))
            podman_options = ['--cap-add=NET_ADMIN', '--cap-add=NET_RAW', '--sysctl', 'net.ipv4.ip_forward=1']
            dnsmasq_replace_resolv_conf = False
            net = injector_access('bridge_net')
            
            class net_config(NetworkConfigModel):
                add(
                    'eth0', mac=persistent_random_mac,
                    net=injector_access('bridge_net'),
                    v4_config=V4Config(
                        address='10.20.100.2',
                        dns_servers=('10.20.100.1', 
                                    ),
                        dhcp=False
                    )
                )

        def build_container(device):
            device_name = device.name
            device_dhcp = device.dhcp
            device_mac = device.mac_address if device.mac_address else persistent_random_mac
            device_ipv4 = device.ipv4_manual
            device_gateway = device.gateway
            device_dns_servers = device.dns_servers
            device_image = model_store.get_device_container_image(device)

            @dynamic_name(device.name)
            class whs_container(MachineModel):
                device_model = device
                add_provider(machine_implementation_key, dependency_quote(PodmanContainer))
                add_provider(oci_container_image, device_image.name)
                name = device_name

            return whs_container

        def build_bare_metal(device):
            @dynamic_name(device.name)
            class whs_bare_metal(MachineModel):
                device_model = device
                name = device.name
                add_provider(machine_implementation_key, dependency_quote(BareMetalMachine))
                running = True

            return whs_bare_metal

        def build_vm(device):

            device_dhcp = device.dhcp
            device_mac = device.mac_address if device.mac_address else persistent_random_mac
            device_ipv4 = device.ipv4_manual
            device_gateway = device.gateway
            device_dns_servers = device.dns_servers
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
