import asyncio
from carthage import *
import carthage.libvirt
from carthage.modeling import *
from carthage.podman import *
from carthage.oci import *
from carthage.network import V4Config
from carthage.systemd import SystemdNetworkModelMixin
from carthage_base import *
from .images import WhsBaseImage, WhsRouter, whs_vm_image
from .web_backend import web_server_key
from .models import ModelStore
from pathlib import Path


root_path = Path(__file__).parent.parent
assignments_path = root_path/"assignments.yml"


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
        from .images import WhsBaseImage, WhsRouter, whs_vm_image
        add_provider(podman_container_host, LocalPodmanContainerHost)
        add_provider(persistent_seed_path, assignments_path)
        add_provider(MachineDependency(f'router.{domain}'))

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

        def build_vm(device):

            device_dhcp = device.dhcp
            device_mac = device.mac_address if device.mac_address else persistent_random_mac
            device_ipv4 = device.ipv4_manual
            device_gateway = device.gateway
            device_dns_servers = device.dns_servers
            device_image = model_store.get_device_image(device)
            vm_image = (
                dependency_quote(Path(config.vm_image_dir)/"images" / device_image.name)
                if device_image is not None
                else whs_vm_image
            )

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

                class net_config(NetworkConfigModel):
                    if not device_dhcp:
                        add(
                            'eth0',
                            mac=device_mac,
                            net=injector_access('bridge_net'),
                            v4_config=V4Config(dhcp=False,
                                               address=device_ipv4,
                                               gateway=device_gateway,
                                               dns_servers=device_dns_servers)
                        )
                    else:
                        add(
                            'eth0',
                            mac=device_mac,
                            net=injector_access('bridge_net'),
                            v4_config=V4Config(dhcp=device_dhcp),
                        )
            return whs_vm

        for id, device in model_store.devices.items():
            new_vm = build_vm(device)

    return await ainjector(layout)
