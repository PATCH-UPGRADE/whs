'''Integration tests for topology-driven router generation.

These build a CarthageLayout through the real ``load_topology`` +
``build_router`` path using the modeling class-body convention and verify that
a router with multiple connected
networks produces one NetworkLink per connection, with primary links at the
gateway and transit links using a pool or explicit address. ``upstream: true``
adds the default podman network attachment.

They also cover the topology's ``default_network``: ``load_topology``
registers it as an alias of that network's model, and the alias resolves to
the same :class:`carthage.network.Network` instance as the network's own name
at runtime — which is what lets device network configs attach to the
topology's default network without naming it.

The layout is built as a real ``class layout(CarthageLayout):`` body whose
``locals()`` (a ``ModelingNamespace``) is handed to ``load_topology`` /\
``build_router``.  Production router integration (``build_routers`` in the
plugin layout) exercises the same path.
'''
import importlib
import ipaddress

import pytest

from carthage.dependency_injection import InjectionKey
from carthage.modeling import CarthageLayout
from python.topology import (
    RouterModel,
    build_router,
    build_routers,
    current_topology,
    load_topology,
    load_topologies,
)


def _topology(name: str) -> dict:
    '''The topology entry named *name* from the plugin's topology.yml.'''
    import conftest

    return next(
        t for t in load_topologies(conftest.layout_plugin) if t['name'] == name
    )


def _build_layout(injector, topology: dict, *, router_names):
    '''Build a layout class whose body registers *topology*'s networks and the
    named routers via the real load_topology/build_router path.'''
    def _build(ns):
        load_topology(ns, injector=injector)
        for rname in router_names:
            build_router(topology['routers'], rname, ns, injector=injector)

    class layout(CarthageLayout):
        layout_name = 'whs'
        domain = 'whs.local'
        _build(locals())

    return layout


def _router_cls(layout):
    '''The generated router model class among the layout's initial injections.'''
    for _k, (v, _opts) in layout.__initial_injections__.items():
        target = getattr(v, 'value', v)  # unwrap dependency_quote if present
        if isinstance(target, type) and issubclass(target, RouterModel):
            return target
    return None


def test_build_router_registers_sanitized_key(injector, loop):
    """build_router registers the router under the dotted-name-sanitized key
    (``router_whs_local``) in the layout namespace, returning a
    :class:`RouterModel` subclass named for the router FQDN."""
    injector.add_provider(current_topology, 'Flat /24', replace=True)
    topology = _topology('Flat /24')

    captured = {}

    def _build(ns):
        load_topology(ns, injector=injector)
        router = build_router(
            topology['routers'], 'router.whs.local', ns, injector=injector)
        captured['router'] = router
        captured['whs_lab'] = ns['whs_lab']
        captured['keys'] = [k for k in ns.keys() if not k.startswith('_')]

    class layout(CarthageLayout):
        layout_name = 'whs'
        domain = 'whs.local'
        _build(locals())

    assert 'router_whs_local' in captured['keys'], captured['keys']
    assert 'whs_lab' in captured['keys']
    router_cls = captured['router']
    assert issubclass(router_cls, RouterModel)
    assert router_cls.__name__ == 'router_whs_local'
    assert router_cls.name == 'router.whs.local'
    # The registered member and the returned class are the same object.
    assert _router_cls(layout) is router_cls


def test_upstream_router_adds_podman_network(injector, loop):
    """A router with ``upstream: true`` carries ``--network=podman`` (plus the
    base router capabilities) in podman_options."""
    injector.add_provider(current_topology, 'Flat /24', replace=True)
    topology = _topology('Flat /24')
    layout = _build_layout(injector, topology, router_names=['router.whs.local'])
    opts = _router_cls(layout).podman_options
    assert '--network=podman' in opts
    assert '--cap-add=NET_ADMIN' in opts
    assert '--cap-add=NET_RAW' in opts
    assert '--sysctl' in opts
    assert 'net.ipv4.ip_forward=1' in opts


def test_non_upstream_router_has_no_podman_network(injector, loop):
    """A router without ``upstream`` does not get ``--network=podman``."""
    injector.add_provider(current_topology, 'Small Hospital', replace=True)
    topology = _topology('Small Hospital')
    # wifi.whs.local has no upstream key -> no --network=podman
    layout = _build_layout(injector, topology, router_names=['wifi.whs.local'])
    opts = _router_cls(layout).podman_options
    assert '--network=podman' not in opts
    assert '--cap-add=NET_ADMIN' in opts


@pytest.mark.parametrize('transit_address', [None, '10.20.100.2'])
def test_router_resolves_networking_at_runtime(injector, loop, transit_address):
    """End-to-end: instantiating the layout and resolving networking produces a
    router whose primary links use the gateway and transit link uses an
    inherited pool or explicit address, with persistent MACs. This exercises the
    full injector_access -> network model -> NetworkLink path at runtime."""
    injector.add_provider(current_topology, 'Small Hospital', replace=True)
    topology = _topology('Small Hospital')

    def _build(ns):
        if transit_address is not None:
            connections = topology['routers']['wifi.whs.local']['connections']
            connections['hospital_floor']['address'] = transit_address
        load_topology(ns, injector=injector)
        for rname in topology['routers']:
            build_router(topology['routers'], rname, ns, injector=injector)

    class layout(CarthageLayout):
        layout_name = 'whs'
        domain = 'whs.local'
        _build(locals())

    layout_instance = layout(injector=injector)
    models = loop.run_until_complete(layout_instance.resolve_networking(force=True))

    routers = [m for m in models
               if getattr(m, 'name', None) == 'router.whs.local'
               and isinstance(m, RouterModel)]
    assert routers, 'router model did not resolve'
    router = routers[0]

    connections = topology['routers']['router.whs.local']['connections']
    links = router.network_links
    assert sorted(links.keys()) == ['lan0', 'lan1', 'lan2', 'lan3']
    for i, conn in enumerate(connections):
        link = links[f'lan{i}']
        # The link's network is the connected topology network (by name).
        assert link.net.name == conn, (conn, link.net.name)
        subnet = topology['networks'][conn]['subnet']
        net = ipaddress.ip_network(subnet)
        expected_gw = ipaddress.ip_address(int(net.network_address) + 1)
        assert link.merged_v4_config.address == expected_gw
        assert link.merged_v4_config.dhcp is False
        # A persistent MAC was assigned.
        assert link.mac

    wifi_router = next(m for m in models
                       if isinstance(m, RouterModel) and m.name == 'wifi.whs.local')
    transit = wifi_router.network_links['lan0']
    primary = wifi_router.network_links['lan1']
    assert transit.net is router.network_links['lan0'].net
    assert transit.v4_config.address == (
        ipaddress.ip_address(transit_address) if transit_address else None)
    assert transit.merged_v4_config.pool == transit.net.v4_config.pool
    transit.net.assign_addresses()
    address = transit.merged_v4_config.address
    if transit_address is not None:
        assert address == ipaddress.ip_address(transit_address)
    else:
        low, high = transit.merged_v4_config.pool
        assert low <= address <= high
    assert address != router.network_links['lan0'].merged_v4_config.address
    assert primary.merged_v4_config.address == primary.net.v4_config.gateway
    assert transit.mac


def test_build_router_unknown_network_raises(injector):
    """A router connection to a network absent from the topology raises a
    ValueError naming the router and the missing network."""
    router_dict = {
        'router.whs.local': {
            'connections': {'does_not_exist': {'role': 'primary'}},
            'upstream': False,
        }
    }
    locals_dict = {'whs_lab': object()}
    with pytest.raises(ValueError) as exc:
        build_router(router_dict, 'router.whs.local', locals_dict,
                     injector=injector)
    msg = str(exc.value)
    assert 'does_not_exist' in msg
    assert 'router.whs.local' in msg


def test_default_network_alias_resolves_to_same_network(injector):
    """The topology's default network model is also injectable under the
    fixed ``default_network`` key (via :func:`provides`), so a link using
    ``net=injector_access('default_network')`` — as in the layout's
    :class:`DeviceNetworkConfig` — attaches to the topology's default
    network: the same model the router's primary link sits on."""
    injector.add_provider(current_topology, 'Flat /24', replace=True)

    def _build(ns):
        load_topology(ns, injector=injector)

    class layout(CarthageLayout):
        layout_name = 'whs'
        domain = 'whs.local'
        _build(locals())

    injections = layout.__initial_injections__
    default_model = injections[InjectionKey('default_network')][0]
    default_model = getattr(default_model, 'value', default_model)
    lab_model = injections[InjectionKey('whs_lab')][0]
    lab_model = getattr(lab_model, 'value', lab_model)
    # One model, two keys — not a second, parallel network.
    assert default_model is lab_model


def test_build_routers_registers_every_router(injector):
    """``build_routers`` registers a RouterModel for every entry in the
    topology's ``routers`` mapping, and the default network's model is also
    injectable under the fixed ``default_network`` key (via :func:`provides`)."""
    injector.add_provider(current_topology, 'Small Hospital', replace=True)

    def _build(ns):
        load_topology(ns, injector=injector)
        build_routers(ns, injector=injector)

    class layout(CarthageLayout):
        layout_name = 'whs'
        domain = 'whs.local'
        _build(locals())

    injections = layout.__initial_injections__
    for key in ('router_whs_local', 'wifi_whs_local'):
        entry = injections.get(InjectionKey(key))
        assert entry is not None, [k for k in injections]
        model = getattr(entry[0], 'value', entry[0])
        assert issubclass(model, RouterModel)
    # The default network's model is known to the injector under the fixed
    # ``default_network`` key and is the same class as its own entry.
    default_model = injections[InjectionKey('default_network')][0]
    default_model = getattr(default_model, 'value', default_model)
    floor_model = injections[InjectionKey('hospital_floor')][0]
    floor_model = getattr(floor_model, 'value', floor_model)
    assert default_model is floor_model


def test_router_image_is_available_in_plugin_layout(ainjector, loop):
    """The plugin layout makes the :class:`WhsRouter` image available.

    The generated routers reference the image through
    ``injector_access(WhsRouter)`` (keyed by its ``oci_image_tag``), and the
    image is only registered for the layout when ``WhsRouter`` is imported
    into the layout's modeling namespace.  Without that registration the
    deployment fails at instantiation with ``No dependency for
    InjectionKey(PodmanImage, oci_image_tag='localhost/whs-router')``.
    """
    from carthage.podman import PodmanImage
    import conftest

    layout = loop.run_until_complete(
        ainjector.get_instance_async(CarthageLayout))
    # The image class as the plugin layout sees it (the layout's modules
    # live under the plugin package, not under 'python.*').
    WhsRouter = importlib.import_module(
        f'{conftest.layout_plugin.package.__name__}.images').WhsRouter
    # _ready=False resolves the image model without building the image.
    image = loop.run_until_complete(
        layout.ainjector.get_instance_async(
            InjectionKey(PodmanImage, oci_image_tag=WhsRouter.oci_image_tag,
                         _ready=False)))
    assert isinstance(image, WhsRouter)

