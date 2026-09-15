'''Topology-driven network and router model generation.

The plugin's ``topology.yml`` holds the list of named topologies, each with
a set of networks (and their subnets) and routers (and the networks each
router connects).  The topology selected through the
:data:`current_topology` injection key determines which networks and
routers the layout gets.

:func:`load_topology` and :func:`build_router` are both called from inside a
``CarthageLayout`` class body as ``injector(fn, locals())``; assigning the
``@dynamic_name``-decorated class into the layout's
``ModelingNamespace`` registers a model for each network (or router) of the
selected topology.
'''
from __future__ import annotations

import dataclasses
import ipaddress
from typing import TYPE_CHECKING

import yaml

from carthage.dependency_injection import (
    InjectionKey,
    Injector,
    dependency_quote,
    inject,
    inject_autokwargs,
)
from carthage import setup_task
from carthage.modeling import (
    MachineModel,
    NetworkConfigModel,
    NetworkModel,
    dynamic_name,
    injector_access,
    machine_implementation_key,
    provides,
)
from carthage.network import (
    V4Config,
    address_within_network,
    persistent_random_mac,
)
from carthage.oci import oci_container_image
from carthage.podman import PodmanContainer
from carthage.plugins import CarthagePlugin
from carthage.systemd import SystemdNetworkModelMixin
from carthage_base import DhcpRole

from .dynamic_models import WhsNetworkModel
from .images import WhsRouter

if TYPE_CHECKING:
    from pathlib import Path

__all__ = [
    'current_topology', 'load_topologies', 'load_topology',
    'build_router', 'build_routers', 'RouterModel',
]

#: The name of the topology whose networks the layout should define.
current_topology = InjectionKey('current_topology')


class RouterModel(DhcpRole, SystemdNetworkModelMixin, MachineModel):
    '''A router which may be deployed in different subnets across a network
    topology.  Provide the network being used & NetworkConfigModel.

    This is the shared base for the routers produced by
    :func:`build_router`.  It runs DHCP (via :class:`DhcpRole`), renders its
    interfaces with systemd-networkd, and is deployed as a Podman container
    using the :class:`WhsRouter` image.

    Subclasses set :attr:`router_connections` to the topology's
    ``connections`` mapping (network name -> options with a ``role`` of
    ``primary`` or ``transit``); the nested :class:`net_config` turns it into
    one link per network.
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
    #: The topology's connections for this router: network name -> options
    #: (``role``, optional ``address``).  Empty for hand-written routers.
    router_connections: dict = {}

    @setup_task("build routes",
                before=SystemdNetworkModelMixin.generate_network_config)
    async def build_routes(self):
        '''Compute the static routes for each of the router's links.

        Runs before the systemd-networkd configuration is rendered, so
        each :attr:`link.routes <carthage.network.NetworkLink.routes>`
        is populated from the fully-resolved topology (every router and
        its links exist; pool addresses are assigned by
        :func:`extract_routes`).  The routes themselves are derived
        state of the resolved graph — stored on the links only so the
        templates can render them.
        '''
        for link in self.network_links.values():
            link.routes = await extract_routes(link.net, [self])

    @build_routes.invalidator()
    def build_routes(self, last_run=None):
        # Routes are derived state on in-memory links, which are rebuilt
        # from scratch on every run; a persisted stamp would let a later
        # run skip the computation, leaving routes unset for the render
        # (and its hash) to read.  Always invalidated, so it always runs.
        return False


    @inject_autokwargs(connections=InjectionKey('router_connections'))
    class net_config(NetworkConfigModel):
        '''One link per network in the router's :attr:`router_connections`.

        The connections mapping is a provider on the enclosing router model,
        so it is injected here and the links are built in ``__init__`` —
        the interface count is variable, so the class body cannot hold the
        ``add()`` calls.  ``net`` and the primary-link address resolve
        against the live network instance, so they stay deferred.
        '''

        def __init__(self, **kwargs):
            super().__init__(**kwargs)
            for i, (conn, options) in enumerate(self.connections.items()):
                address = options.get('address')
                if address is None and options['role'] == 'primary':
                    address = address_within_network(1)
                self.add(
                    f'lan{i}',
                    mac=persistent_random_mac,
                    net=InjectionKey(conn),
                    v4_config=V4Config(address=address, dhcp=False, dns_servers=()),
                )


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


def _podman_v4_config(v4_config: V4Config) -> V4Config:
    '''The network's *v4_config* as the podman network should see it.

    Identical to *v4_config* except ``dhcp`` is False.  VMs plug into the
    bridge and get addresses from the router's DHCP server, but podman
    containers are handed addresses from the pool by the network's
    static IPAM — a podman network created with the DHCP ipam driver
    needs the netavark DHCP proxy socket, which is not present on the
    deployment host.  Carthage merges this into the network's
    ``v4_config`` when building the podman network (the merge only
    fills unset attributes, so the explicit ``dhcp=False`` is what the
    podman network keeps and everything else is shared).
    '''
    return dataclasses.replace(v4_config, dhcp=False)


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

    If the topology declares a ``default_network``, that network's model is
    also made injectable under the fixed key ``default_network`` (via
    :func:`provides`), so the layout (and e.g. device network configs) can
    refer to the topology's default network without naming it.
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

    default_network = topology.get('default_network')
    if default_network is not None and default_network not in topology['networks']:
        raise ValueError(
            f"Topology {topology_name!r} default_network "
            f"{default_network!r} is not one of its networks: "
            f"{sorted(topology['networks'])}"
        )

    models: dict[str, type] = {}
    for name, netdef in topology['networks'].items():
        subnet = netdef['subnet']
        net = ipaddress.ip_network(subnet)  # fail early on a bad subnet
        gateway = _first_usable(subnet)
        low, high = _dhc_pool(subnet)
        network_config = V4Config(
            network=subnet,
            dhcp=True,
            gateway=gateway,
            pool=(low, high),
            dns_servers=(gateway,),
            domains='whs.local',
        )
        @dynamic_name(name)
        class net(WhsNetworkModel):
            v4_config = network_config
            #: The network's v4_config as the podman network should see it:
            #: identical except ``dhcp=False``, so podman creates the network
            #: with static IPAM (containers get pool addresses) instead of the
            #: DHCP ipam driver, which needs a netavark DHCP proxy socket.  VMs
            #: still get addresses from the router's DHCP server.
            podman_v4_config = _podman_v4_config(network_config)
            podman_unmanaged = True
            #: Disable podman's built-in per-network DNS (aardvark).  In
            #: unmanaged mode the network's gateway (10.x.x.1) is the router's
            #: address, not a host address, so netavark cannot bind it and
            #: container startup fails.  The router's dnsmasq is the DNS
            #: server; containers get it via their per-device --dns option.
            podman_container_dns = False
            #: The unmanaged podman network binds to a pre-existing bridge, and
            #: the qemu side (``BridgeNetwork``) plugs VM vNICS into a bridge of
            #: its own.  Point both at the same device — named for the network —
            #: so podman and qemu agree on the same network identity.
            bridge_name = name
            podman_bridge_name = name

        if name == default_network:
            # Non-decorator form (see modeling docs): the model is also
            # known under the fixed key ``default_network``.
            net = provides(InjectionKey('default_network'))(net)
        topology_locals[name] = net
        models[name] = net


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
    ``MachineDependency(name)`` (the model's ``name`` is the FQDN).  The
    connections mapping itself is stored on the model as
    :attr:`RouterModel.router_connections`, so a router instance can see its
    own topology.
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
    # If the router is the primary router of one of its networks, that
    # network's model provides the ``primary_router`` key so that
    # :func:`extract_routes` (working with instances, not models) can
    # recognize the primary without any other marker.  The provider is an
    # ``injector_access`` — pointing at the router under its name on the
    # layout injector — rather than the router model itself: the model
    # would otherwise be instantiated once per injector it is
    # ``add_provider``ed on (the network's and the layout's), and we want
    # a single shared instance.
    for conn, options in connections.items():
        if options['role'] == 'primary':
            net = topology_locals[conn]
            net.add_provider(
                InjectionKey('primary_router'),
                injector_access(InjectionKey(MachineModel, host=router_name)))

    # The interface count is variable (one link per connection), so
    # RouterModel.net_config builds its links in __init__ from the
    # injected router_connections provider; the router subclass only
    # supplies the topology data as a class attribute.
    class router(RouterModel):
        name = router_name
        podman_options = podman_opts
        router_connections = connections
    # Built outside a modeling class body, so @dynamic_name would leave a
    # decorator wrapper behind; rename the class directly instead.
    router.__name__ = local_key
    router.__qualname__ = local_key

    topology_locals[local_key] = router
    return router


@inject(injector=Injector)
def build_routers(topology_locals: dict, *, injector: Injector) -> None:
    '''Register a :class:`RouterModel` for every router in the current topology.

    Called from a ``CarthageLayout`` class body (after
    ``injector(load_topology, locals())``) as::

        injector(build_routers, locals())

    where *topology_locals* is the layout's ``ModelingNamespace``.  This
    resolves the topology named by :data:`current_topology` and calls
    :func:`build_router` for each of its ``routers`` entries, so the layout
    picks up every topology router without naming them individually.
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
    for name in topology.get('routers', {}):
        build_router(topology['routers'], name, topology_locals, injector=injector)


async def extract_routes(net: NetworkModel,
                         exclude: list[MachineModel]) -> list[
        tuple[ipaddress.IPv4Network, ipaddress.IPv4Address]]:
    '''Extract the static routes of *net* from the resolved network models.

    Called after the layout has been instantiated and its networking
    resolved (the ``network_links`` dictionaries are populated and link
    ``v4_config`` addresses have been assigned), e.g. as
    ``await ainjector(extract_routes, net, exclude)``.

    For every link of *net* whose machine is a :class:`RouterModel`
    (links to anything else are ignored), the router's address on *net*
    is the *destination address* for its routes.  If the router is the
    primary router of *net* (see the ``primary_router`` provider installed
    by :func:`build_router`), *net* gets a single default route through
    it.  Otherwise, for each *other* network the router is linked to, a
    route is recorded for that network: a route through the router's
    address on *net* reaches that network.

    :param net: The network whose routes are being extracted.
    :param exclude: Routers to skip; no routes whose destination would
        be one of them are recorded.

    :return: A list of ``(destination, gateway)`` tuples: *destination*
        is an :class:`ipaddress.IPv4Network` (``0.0.0.0/0`` for a default
        route) and *gateway* is an :class:`ipaddress.IPv4Address` — the
        router's address on *net*.  Each destination network appears at
        most once; if *net* has two non-primary routers that both reach
        the same network, the first one seen wins.
    '''
    routes: list[tuple[ipaddress.IPv4Network, ipaddress.IPv4Address]] = []
    seen: set[ipaddress.IPv4Network] = set()
    default_net = ipaddress.IPv4Network('0.0.0.0/0')
    # ``net.network_links`` is a ``weakref.WeakSet`` — iteration order is
    # arbitrary, so sort for a stable "first seen wins" result.
    for link in sorted(net.network_links,
                       key=lambda l: (l.machine.name, l.interface)):
        machine = link.machine
        if not isinstance(machine, RouterModel):
            continue
        if any(machine is excluded for excluded in exclude):
            continue
        address = link.merged_v4_config.address
        if address is None and link.merged_v4_config.pool:
            # Pool-assigned addresses are only set once the pool runs
            # assignment; do that now.  It is idempotent — the
            # render-time call in the network template re-asserts the
            # same address via force_assignment.
            net.assign_addresses(link)
            address = link.merged_v4_config.address
        if address is None:
            continue
        # ``build_router`` provides the network's ``primary_router`` key
        # with an ``injector_access`` of the router instance, so this
        # returns that same instance — the identity check is exact.
        if (net.injector.get_instance(
                InjectionKey('primary_router', _ready=False, _optional=True))
                is machine):
            if default_net not in seen:
                seen.add(default_net)
                routes.append((default_net, address))
        else:
            for other in machine.network_links.values():
                if other.net is net:
                    continue  # the link on this network itself
                peer_net = other.net
                cidr = peer_net.v4_config.network
                if cidr is None or cidr in seen:
                    continue
                seen.add(cidr)
                routes.append((cidr, address))
    return routes
