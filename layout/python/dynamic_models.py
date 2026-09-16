from __future__ import annotations

import dataclasses
import ipaddress

from pydantic import BaseModel, Field

from carthage import Machine, setup_task
from carthage.deployment import Deployable, DeploymentFailure, DeploymentResult
from carthage.dependency_injection import InjectionKey, dependency_quote, inject_autokwargs
from carthage.network import (
    BridgeNetwork,
    TechnologySpecificNetwork,
    this_network,
    V4Config,
    address_within_network,
    persistent_random_mac,
)
from carthage.modeling import (
    MachineModel,
    NetworkConfigModel,
    NetworkModel,
    injector_access,
    machine_implementation_key,
)
from carthage.oci import oci_container_image
from carthage.podman import PodmanNetwork, PodmanContainer
from carthage.systemd import SystemdNetworkModelMixin
from carthage_base import DhcpRole
from carthage.entanglement import carthage_registry, entanglement_instrumentation
from entanglement.interface import sync_property
from entanglement.memory import StoreInSyncStoreMixin

from .images import WhsRouter
from .models import Device

"""
Models for dynamic Carthage objects that are transported to the frontend.
"""

__all__: list[str] = []


class DeviceDeployable(BaseModel):
    """A device as actually deployed."""

    id: str
    name: str


__all__ += ["DeviceDeployable"]


class NetworkDeployable(BaseModel):
    """A network in the topology."""

    name: str
    network: str = Field(description="The network and netmask in CIDR notation")


__all__ += ["NetworkDeployable"]


FrontendDeployable = DeviceDeployable | NetworkDeployable

__all__ += ["FrontendDeployable"]


class FrontendDeploymentResult(BaseModel):
    running: bool = False
    successes: list[FrontendDeployable] = Field(default_factory=list)
    failures: list[str] = Field(default_factory=list)
    dependency_failures: list[str] = Field(default_factory=list)
    ignored: list[FrontendDeployable] = Field(default_factory=list)
    orphans: list[FrontendDeployable] = Field(default_factory=list)


__all__ += ["FrontendDeploymentResult"]


def map_deployable(d: Deployable) -> FrontendDeployable | None:
    match d:
        case Machine() as machine:
            device = getattr(getattr(machine, "model", None), "device_model", None)
            if isinstance(device, Device):
                return DeviceDeployable(id=device.id, name=machine.name)
            return None
        case TechnologySpecificNetwork() as net:
            model = net.injector.get_instance(this_network)
            try:
                cidr = str(model.v4_config.network)
            except AttributeError:
                cidr = ""
            return NetworkDeployable(name=model.name, network=cidr)
        case _:
            return None


__all__ += ["map_deployable"]


def map_deployables(deployables: list[Deployable]) -> list[FrontendDeployable]:
    return [frontend for deployable in deployables if (frontend := map_deployable(deployable))]


__all__ += ["map_deployables"]


def map_deployment_failure(failure: DeploymentFailure) -> str:
    return str(failure)


def map_deployment_result(
    result: DeploymentResult,
    *,
    running: bool = False,
) -> FrontendDeploymentResult:
    return FrontendDeploymentResult(
        running=running,
        successes=map_deployables(result.successes),
        failures=[map_deployment_failure(f) for f in result.failures],
        dependency_failures=[map_deployment_failure(d) for d in result.dependency_failures],
        ignored=map_deployables(result.ignored),
        orphans=map_deployables(result.orphans),
    )


__all__ += ["map_deployment_result"]


@inject_autokwargs(bridge=BridgeNetwork)
class UnmanagedPodmanNetwork(PodmanNetwork):
    """A podman network that requires its :class:`BridgeNetwork` to exist first.

    ``PodmanNetwork`` in unmanaged mode registers the network with podman and
    binds it to a pre-existing bridge (named by the model's
    ``podman_bridge_name``); it does not create the bridge device.  Injecting
    the :class:`BridgeNetwork` as a dependency makes the injector create and
    bring up that bridge (``ip link add ... type bridge``) before this
    network's ``do_create`` runs ``podman network create``.

    The injected ``bridge`` instance is not used beyond being a ready
    dependency; the body is deliberately empty.
    """


__all__ += ["UnmanagedPodmanNetwork"]


class WhsNetworkModel(NetworkModel):
    """A WHS network.

    Subclasses :class:`carthage.modeling.NetworkModel` so it drops into a
    ``CarthageLayout`` like any other network, and is instrumented (below) so
    that instantiating one stores a :class:`WhsEntangledNetwork` in the carthage
    entanglement registry.

    Provides :class:`UnmanagedPodmanNetwork` as the technology-specific
    network implementation, so every network created from this model (or a
    subclass of it) brings up its bridge before registering the unmanaged
    podman network.
    """

    add_provider(InjectionKey(PodmanNetwork), UnmanagedPodmanNetwork)


__all__ += ["WhsNetworkModel"]


@dataclasses.dataclass
class WhsEntangledNetwork(StoreInSyncStoreMixin):
    """A WHS network as synchronized into the carthage entanglement registry.

    Carries the network's ``name``, its ``v4_config`` network (CIDR), and the
    id of the injector that produced the :class:`WhsNetworkModel`. Belongs
    to :data:`carthage_registry` via ``sync_registry``.
    """

    name: str = sync_property(constructor=True)
    network: str = sync_property(constructor=True)
    injector_id: int = sync_property(constructor=True)

    sync_primary_keys = ('name',)
    sync_registry = carthage_registry


__all__ += ["WhsEntangledNetwork"]


@entanglement_instrumentation(WhsNetworkModel)
def sync_whs_network(value, registry):
    """Store a :class:`WhsEntangledNetwork` for each instantiated WhsNetworkModel.

    Invoked by the carthage entanglement instrumentation whenever a
    :class:`WhsNetworkModel` is produced by an injector.
    """
    try:
        network = str(value.v4_config.network)
    except AttributeError:
        network = ""
    registry.store_synchronize(
        WhsEntangledNetwork(
            name=value.name,
            network=network,
            injector_id=registry.injector_id(value.injector),
        )
    )


__all__ += ["sync_whs_network"]


class RouterModel(DhcpRole, SystemdNetworkModelMixin, MachineModel):
    '''A router which may be deployed in different subnets across a network
    topology.  Provide the network being used & NetworkConfigModel.

    This is the shared base for the routers produced by
    :func:`python.topology.build_router`.  It runs DHCP (via
    :class:`DhcpRole`), renders its interfaces with systemd-networkd, and is
    deployed as a Podman container using the :class:`WhsRouter` image.

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

    async def async_ready(self):
        # Resolve this router's networking before it becomes ready, and
        # snapshot the result into the carthage entanglement registry as
        # the :class:`EntangledRouter`.
        #
        # ``resolve_networking`` runs first so ``network_links`` is
        # populated before :func:`super().async_ready` runs the router's
        # setup tasks (``build_routes`` reads the links).  The snapshot
        # is taken explicitly at the end — rather than relying on the
        # ``dependency_final``-driven :func:`sync_router` callback —
        # because that callback only re-fires for a router that is a
        # *dependency of something else* (e.g. the ``primary_router`` of
        # a network).  A router that is nobody's dependency (e.g. a
        # transit-only router) never re-fires, so its record would
        # otherwise stay at the premature construct-time (empty)
        # snapshot.  Capturing here, once per ready, is deterministic:
        # by the time ``async_ready`` returns the router's links are the
        # resolved topology.
        await self.resolve_networking()
        await super().async_ready()
        store_router(self, carthage_registry)


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


__all__ += ["RouterModel"]


@dataclasses.dataclass
class EntangledRouter(StoreInSyncStoreMixin):
    """A router as synchronized into the carthage entanglement registry.

    Deliberately denormalized: one object per router carrying the flattened
    per-link data the frontend needs to draw the topology.
    ``network_links`` maps interface name (``lan0``, ``lan1``, ...) to a
    dict with ``net`` (the network's name), ``mac`` (the link's MAC
    address), and ``address`` (the link's ``merged_v4_config.address`` —
    ``None`` until pool assignment runs).  Belongs to
    :data:`carthage_registry` via ``sync_registry``.
    """

    name: str = sync_property(constructor=True)
    network_links: dict = sync_property(constructor=True)

    sync_primary_keys = ('name',)
    sync_registry = carthage_registry


__all__ += ["EntangledRouter"]


@entanglement_instrumentation(RouterModel)
def sync_router(value, registry):
    """Store an :class:`EntangledRouter` for each instantiated RouterModel.

    Invoked by the carthage entanglement instrumentation on
    ``dependency_final``, which fires when the router is brought to
    ready.  :meth:`RouterModel.async_ready` resolves the router's
    networking *before* it becomes ready, so by the time this callback
    runs the router's ``network_links`` are populated and the snapshot
    reflects the resolved topology.
    """
    store_router(value, registry)


__all__ += ["sync_router"]


def store_router(value, registry):
    """Store (upsert) the :class:`EntangledRouter` snapshot of *value*.

    ``network_links`` maps each interface name (``lan0``, ``lan1``, ...)
    to its network name, MAC, and the link's
    ``merged_v4_config.address`` (``None`` until pool assignment runs).
    Keyed by the router's ``name``, so repeated calls replace the
    earlier record with the most recently resolved state.
    """
    network_links = {}
    for interface, link in value.network_links.items():
        address = link.merged_v4_config.address
        network_links[interface] = {
            'net': link.net.name,
            'mac': link.mac,
            'address': str(address) if address is not None else None,
        }
    registry.store_synchronize(
        EntangledRouter(
            name=value.name,
            network_links=network_links,
        )
    )


__all__ += ["store_router"]


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
    by :func:`python.topology.build_router`), *net* gets a single default
    route through it.  Otherwise, for each *other* network the router is
    linked to, a route is recorded for that network: a route through the
    router's address on *net* reaches that network.

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


__all__ += ["extract_routes"]



