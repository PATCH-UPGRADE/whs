'''Topology-driven network and router model generation.

The plugin's ``topology.yml`` holds the list of named topologies, each with
a set of networks (and their subnets) and routers (and the networks each
router connects).  The topology selected through the
:data:`current_topology` injection key determines which networks and
routers the layout gets.

:func:`load_topology` and :func:`build_router` are both called from inside a
``CarthageLayout`` class body as ``injector(fn, locals())``; because the
``locals()`` of a modeling class body is a ``ModelingNamespace``, assigning
the ``@dynamic_name``-decorated class into it registers a model for each
network (or router) of the selected topology.
'''
from __future__ import annotations

import ipaddress
import types
from typing import TYPE_CHECKING

import yaml

from carthage.dependency_injection import (
    InjectionKey,
    Injector,
    dependency_quote,
    inject,
)
from carthage.modeling import (
    MachineModel,
    NetworkConfigModel,
    dynamic_name,
    injector_access,
    machine_implementation_key,
)
from carthage.network import V4Config, persistent_random_mac
from carthage.oci import oci_container_image
from carthage.podman import PodmanContainer
from carthage.plugins import CarthagePlugin
from carthage.systemd import SystemdNetworkModelMixin
from carthage_base import DhcpRole

from .dynamic_models import WhsNetworkModel
from .images import WhsRouter

if TYPE_CHECKING:
    from pathlib import Path

__all__ = ['current_topology', 'load_topologies', 'load_topology', 'build_router', 'RouterModel']

#: The name of the topology whose networks the layout should define.
current_topology = InjectionKey('current_topology')


class RouterModel(DhcpRole, SystemdNetworkModelMixin, MachineModel):
    '''A router which may be deployed in different subnets across a network
    topology.  Provide the network being used & NetworkConfigModel.

    This is the shared base for the routers produced by
    :func:`build_router`.  It runs DHCP (via :class:`DhcpRole`), renders its
    interfaces with systemd-networkd, and is deployed as a Podman container
    using the :class:`WhsRouter` image.
    '''
    override_dependencies = True
    add_provider(machine_implementation_key, dependency_quote(PodmanContainer))
    add_provider(oci_container_image, injector_access(WhsRouter))
    podman_options = [
        '--cap-add=NET_ADMIN',
        '--cap-add=NET_RAW',
        '--sysctl', 'net.ipv4.ip_forward=1',
    ]
    dnsmasq_replace_resolv_conf = False


def _first_usable(subnet) -> str:
    '''The first usable address of *subnet* (``.1`` for a normal prefix).'''
    net = ipaddress.ip_network(str(subnet))
    return str(ipaddress.ip_address(int(net.network_address) + 1))


def _dhc_pool(subnet) -> tuple[str, str]:
    '''A ``(low, high)`` DHCP pool covering ``.10``-``.200`` of *subnet*.'''
    net = ipaddress.ip_network(str(subnet))
    base = int(net.network_address)
    last = int(net.broadcast_address)
    low = ipaddress.ip_address(base + 10)
    high = ipaddress.ip_address(min(base + 200, last - 1))
    return (str(low), str(high))


def load_topologies(plugin: CarthagePlugin) -> list[dict]:
    '''Read the topology definitions from the plugin's topology.yml.'''
    path: Path = plugin.resource_dir / 'topology.yml'
    with path.open() as f:
        return yaml.safe_load(f)


@inject(injector=Injector)
def load_topology(topology_locals: dict, *, injector: Injector):
    '''Define a ``WhsNetworkModel`` for each network in the current topology.

    Called from a ``CarthageLayout`` class body as
    ``injector(load_topology, locals())``; the ``locals()`` of the class body
    (a ``ModelingNamespace``) is passed positionally and the ``injector`` is
    resolved by the injector.  For every network of the topology named by
    :data:`current_topology`, a ``WhsNetworkModel`` subclass is defined with
    the network's subnet as its ``v4_config`` and registered under the
    network's name.

    Each network's ``v4_config`` carries the full DHCP-relevant configuration
    that the router's dnsmasq reads: the gateway (``.1``), a DHCP pool
    (``.10``-``.200``), the DNS server (the gateway), and the domain.
    '''
    plugin = injector.get_instance(InjectionKey(CarthagePlugin, name='whs'))
    topology_name = injector.get_instance(current_topology)
    topologies = load_topologies(plugin)
    try:
        topology = next(t for t in topologies if t['name'] == topology_name)
    except StopIteration:
        raise ValueError(
            f"Unknown topology {topology_name!r}; "
            f"available: {[t['name'] for t in topologies]}"
        ) from None

    for name, netdef in topology['networks'].items():
        subnet = netdef['subnet']
        net = ipaddress.ip_network(subnet)  # fail early on a bad subnet
        gateway = _first_usable(subnet)
        low, high = _dhc_pool(subnet)
        @dynamic_name(name)
        class net(WhsNetworkModel):
            v4_config = V4Config(
                network=subnet,
                dhcp=True,
                gateway=gateway,
                pool=(low, high),
                dns_servers=(gateway,),
                domains='whs.local',
            )
            podman_unmanaged = True

        topology_locals[name] = net


@inject(injector=Injector)
def build_router(topology_router_dict: dict, name: str,
                 topology_locals: dict, *, injector: Injector) -> type:
    '''Build and register a ``RouterModel`` subclass for one topology router.

    Called from a ``CarthageLayout`` class body (which has already run
    ``injector(load_topology, locals())``) as::

        injector(build_router, topology['routers'], name, locals())

    where *topology_router_dict* is the topology's ``routers`` mapping,
    *name* is the router's FQDN (e.g. ``router.whs.local``),
    *topology_locals* is the layout's ``ModelingNamespace`` (its
    ``locals()``), and *injector* is resolved by the injector.

    For each network the router connects (in the order listed in the
    topology), a ``NetworkConfigModel`` interface (``lan0``, ``lan1``, ...)
    is added with a persistent random MAC. Connections map network names to
    options with a ``role`` of ``primary`` or ``transit``. Primary connections
    use the network's gateway (``.1``); transit connections inherit its address
    pool unless an explicit ``address`` is supplied. Address validation is
    deferred to layout integration, as is DHCP-service suppression on transit
    interfaces. When the router has ``upstream: true``, the
    default Podman network is also attached (``--network=podman``); further
    upstream NAT/masquerading is intentionally out of scope for now.

    The generated class is registered in *topology_locals* under the router
    name with dots replaced by underscores (e.g. ``router_whs_local``), so it
    is instantiated as a member of the layout and is findable by
    ``MachineDependency(name)`` (the model's ``name`` is the FQDN).
    '''
    router_def = topology_router_dict[name]
    connections = router_def['connections']
    for conn in connections:
        if conn not in topology_locals:
            raise ValueError(
                f"Router {name!r} in topology references unknown network "
                f"{conn!r}; networks: {sorted(topology_locals.keys())}"
            )
    upstream = bool(router_def.get('upstream', False))
    podman_opts = [
        '--cap-add=NET_ADMIN',
        '--cap-add=NET_RAW',
        '--sysctl', 'net.ipv4.ip_forward=1',
    ]
    if upstream:
        podman_opts.append('--network=podman')

    router_name = name
    local_key = name.replace('.', '_')

    # The router's NetworkConfigModel needs one add() per connected network,
    # which is a variable number.  A class body cannot hold a variable number
    # of add() calls, so net_config is built with types.new_class, whose
    # exec_body runs against a ModelingNamespace where `add` resolves as a
    # modelmethod (registering one deferred callback per interface).
    def net_config_body(namespace):
        for i, (conn, options) in enumerate(connections.items()):
            interface = f'lan{i}'
            # load_topology stored an injector_access wrapper under each
            # network name; its .target is the network model class, whose
            # _v4_config holds the resolved subnet and gateway.
            net_model = topology_locals[conn]
            target = getattr(net_model, 'target', net_model)
            v4 = target._v4_config
            gateway = str(v4.gateway) if v4.gateway else _first_usable(v4.network)
            address = options.get('address')
            if address is None and options['role'] == 'primary':
                address = gateway
            namespace['add'](
                interface,
                mac=persistent_random_mac,
                net=injector_access(conn),
                v4_config=V4Config(address=address, dhcp=False, dns_servers=()),
            )

    # The router model is also built with types.new_class so its body can
    # nest the dynamically built net_config.  Nesting (assigning net_config
    # into the router's own ModelingNamespace) is what registers the
    # NetworkConfig in the router's to_inject; a plain attribute set on the
    # completed class would not.  Setting an attribute first also makes the
    # router's namespace the active modeling context, so net_config's
    # namespace correctly nests under the router.
    def router_body(namespace):
        namespace['name'] = router_name
        namespace['podman_options'] = podman_opts
        net_config = types.new_class(
            'net_config', (NetworkConfigModel,), exec_body=net_config_body)
        namespace['net_config'] = net_config

    router = types.new_class(local_key, (RouterModel,), exec_body=router_body)
    topology_locals[local_key] = router
    return router
