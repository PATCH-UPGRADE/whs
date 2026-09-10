from __future__ import annotations

import dataclasses

from pydantic import BaseModel, Field

from carthage import Machine
from carthage.deployment import Deployable, DeploymentFailure, DeploymentResult
from carthage.network import TechnologySpecificNetwork, this_network
from carthage.modeling import NetworkModel
from carthage.entanglement import carthage_registry, entanglement_instrumentation
from entanglement.interface import sync_property
from entanglement.memory import StoreInSyncStoreMixin

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


class WhsNetworkModel(NetworkModel):
    """A WHS network.

    Subclasses :class:`carthage.modeling.NetworkModel` so it drops into a
    ``CarthageLayout`` like any other network, and is instrumented (below) so
    that instantiating one stores a :class:`WhsEntangledNetwork` in the carthage
    entanglement registry.
    """


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



