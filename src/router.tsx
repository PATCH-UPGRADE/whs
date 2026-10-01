import {
  createRootRoute,
  createRoute,
  createRouter,
  type RouteComponent,
} from "@tanstack/react-router";
import { DeviceDetail } from "./components/features/devices/DeviceDetail";
import { DevicesContainer } from "./components/features/devices/Devices";
import { ImagesContainer } from "./components/features/images/Images";
import { ImportExportContainer } from "./components/features/import-export/ImportExport";
import { PcapsContainer } from "./components/features/pcaps/Pcaps";
import { DeployTopologyContainer } from "./components/features/topologies/DeployTopology";
import { TopologiesContainer } from "./components/features/topologies/Topologies";
import { TopologyContainer } from "./components/features/topologies/Topology";

const rootRoute = createRootRoute();

const routeConfig: Array<[path: string, component: RouteComponent]> = [
  ["/", DevicesContainer],
  ["/devices", DevicesContainer],
  ["/devices/$deviceId", DeviceDetail],
  ["/images", ImagesContainer],
  ["/topologies", TopologiesContainer],
  ["/topologies/$topologyName", TopologyContainer],
  ["/deploy", DeployTopologyContainer],
  ["/pcaps", PcapsContainer],
  ["/import-export", ImportExportContainer],
];

const routes = routeConfig.map(([path, component]) =>
  createRoute({ getParentRoute: () => rootRoute, path, component }),
);

const routeTree = rootRoute.addChildren(routes);
const router = createRouter({ routeTree });

export default router;
