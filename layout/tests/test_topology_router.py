'''Integration tests for topology-driven router generation.

These build a CarthageLayout through the real ``load_topology`` +
``build_router`` path (the same functions the production layout body calls via
``injector(fn, locals())``) and verify that a router with multiple connected
networks produces one NetworkLink per connection, each addressed at the
connected network's gateway (``.1``), and that ``upstream: true`` adds the
default podman network attachment.

The layout is built as a real ``class layout(CarthageLayout):`` body whose
``locals()`` (a ``ModelingNamespace``) is handed to ``load_topology`` /
``build_router`` — exactly how the production ``build_layout`` does it.
'''
import ipaddress

import pytest

from carthage.modeling import CarthageLayout
from python.topology import (
    RouterModel,
    build_router,
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


def test_router_one_link_per_connection_at_gateway(injector, loop):
    """A router connecting to four networks registers a net_config with four
    link specs (lan0..lan3), each a static interface addressed at the
    connected network's ``.1`` gateway (intentionally ``.1``, not the old
    ``.2`` practice)."""
    injector.add_provider(current_topology, 'Small Hospital', replace=True)
    topology = _topology('Small Hospital')
    layout = _build_layout(injector, topology, router_names=['router.whs.local'])

    from carthage.network import NetworkConfig

    router_cls = _router_cls(layout)
    assert router_cls is not None, 'router model not registered'
    assert router_cls.name == 'router.whs.local'

    # net_config is nested in the router, so it registers in the router's own
    # initial injections (not the layout's).
    net_config_cls = None
    for _k, (v, _opts) in router_cls.__initial_injections__.items():
        target = getattr(v, 'value', v)
        if isinstance(target, type) and issubclass(target, NetworkConfig):
            net_config_cls = target
    assert net_config_cls is not None, 'net_config not registered on router'

    connections = topology['routers']['router.whs.local']['connections']
    assert len(connections) == 4

    # net_config's link specs are populated by its add() callbacks; run them
    # against a fresh instance to read the resolved specs.
    inst = object.__new__(net_config_cls)
    NetworkConfig.__init__(inst)
    for cb in net_config_cls._callbacks:
        cb(inst)
    assert sorted(inst.link_specs.keys()) == ['lan0', 'lan1', 'lan2', 'lan3']

    for i, conn in enumerate(connections):
        spec = inst.link_specs[f'lan{i}']
        subnet = topology['networks'][conn]['subnet']
        net = ipaddress.ip_network(subnet)
        expected_gw = ipaddress.ip_address(int(net.network_address) + 1)
        assert str(spec['v4_config'].address) == str(expected_gw), (
            conn, spec['v4_config'].address, expected_gw)
        assert spec['v4_config'].dhcp is False


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


def test_router_resolves_networking_at_runtime(injector, loop):
    """End-to-end: instantiating the layout and resolving networking produces a
    router whose NetworkLinks resolve to the connected topology networks, each
    at its ``.1`` gateway, static, with a persistent MAC.  This exercises the
    full injector_access -> network model -> NetworkLink path at runtime."""
    injector.add_provider(current_topology, 'Small Hospital', replace=True)
    topology = _topology('Small Hospital')

    def _build(ns):
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


def test_build_router_unknown_network_raises(injector):
    """A router connection to a network absent from the topology raises a
    ValueError naming the router and the missing network."""
    router_dict = {
        'router.whs.local': {
            'connections': ['does_not_exist'],
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
