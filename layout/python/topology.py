'''Topology-driven network model generation.

The plugin's ``topology.yml`` holds the list of named topologies, each with
a set of networks (and their subnets).  The topology selected through the
:data:`current_topology` injection key determines which networks the layout
gets.  :func:`load_topology` is called
from inside a ``CarthageLayout`` class body as
``injector(load_topology, locals())``; because the ``locals()`` of a modeling class body is a
``ModelingNamespace``, assigning the
``@dynamic_name``-decorated class into it registers a ``WhsNetworkModel``
subclass for each network of the selected topology.
'''
from __future__ import annotations

import ipaddress
from typing import TYPE_CHECKING

import yaml

from carthage.dependency_injection import InjectionKey, Injector, inject
from carthage.modeling import dynamic_name
from carthage.network import V4Config
from carthage.plugins import CarthagePlugin

from .dynamic_models import WhsNetworkModel

if TYPE_CHECKING:
    from pathlib import Path

__all__ = ['current_topology', 'load_topologies', 'load_topology']

#: The name of the topology whose networks the layout should define.
current_topology = InjectionKey('current_topology')


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
    :data:`current_topology`, a ``WhsNetworkModel`` subclass is defined with the
    network's subnet as its ``v4_config`` and registered under the network's
    name.
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
        ipaddress.ip_network(subnet)  # fail early on a bad subnet
        @dynamic_name(name)
        class net(WhsNetworkModel):
            v4_config = V4Config(network=subnet, dhcp=True)

        topology_locals[name] = net
