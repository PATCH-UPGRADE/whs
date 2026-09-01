import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { DeviceDetail } from "./components/features/devices/DeviceDetail";
import { DevicesContainer } from "./components/features/devices/Devices";
import { VmImagesContainer } from "./components/features/images/Images";
import { ImportExportContainer } from "./components/features/import-export/ImportExport";
import { PcapsContainer } from "./components/features/pcaps/Pcaps";
import { DeployTopologyContainer } from "./components/features/topologies/Topologies";

const rootRoute = createRootRoute();

const routes = [
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <DevicesContainer />,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/devices/$deviceId",
    component: () => <DeviceDetail />,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/devices",
    component: () => <DevicesContainer />,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/vm-images",
    component: () => <VmImagesContainer />,
  }),
  // createRoute({
  //   getParentRoute: () => rootRoute,
  //   path: "/topologies",
  //   component: () => <TopologiesContainer />,
  // }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/pcaps",
    component: () => <PcapsContainer />,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/deploy",
    component: () => <DeployTopologyContainer />,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/import-export",
    component: () => <ImportExportContainer />,
  }),
];

const routeTree = rootRoute.addChildren(routes);
const router = createRouter({ routeTree });

export default router;
