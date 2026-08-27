import { useQuery } from "@tanstack/react-query";
import { Check, Equal, SlashIcon, TriangleAlert, User } from "lucide-react";
import React, { useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDeploymentStatus, startDeploy } from "./hooks";
import type { TopologyStatusResponseStatus } from "./types";

interface DeploymentStatusI {
  value: Exclude<keyof TopologyStatusResponseStatus, "running">;
  name: string;
  header: string;
  description: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconElement: typeof Check;
}

const STATUSES: DeploymentStatusI[] = [
  {
    value: "successes",
    name: "Successes",
    header: "SUCCESS",
    description: "",
    bgColor: "bg-green-200",
    borderColor: "border-green-500",
    textColor: "text-green-900",
    iconElement: Check,
  },
  {
    value: "failures",
    name: "Failures",
    header: "FAILURE",
    description: "",
    bgColor: "bg-red-200",
    borderColor: "border-red-500",
    textColor: "text-red-900",
    iconElement: TriangleAlert,
  },
  {
    value: "dependency_failures",
    name: "Dependency Failures",
    header: "DEPENDENCY FAILURE",
    description: "",
    bgColor: "bg-orange-200",
    borderColor: "border-orange-500",
    textColor: "text-orange-900",
    iconElement: TriangleAlert,
  },
  {
    value: "orphans",
    name: "Orphans",
    header: "ORPHAN",
    description: "",
    bgColor: "bg-purple-200",
    borderColor: "border-purple-500",
    textColor: "text-purple-900",
    iconElement: User,
  },
  {
    value: "ignored",
    name: "Ignored",
    header: "IGNORED",
    description: "",
    bgColor: "bg-neutral-200",
    borderColor: "border-neutral-500",
    textColor: "text-neutral-900",
    iconElement: Equal,
  },
];

export const DeployTopologyContainer = () => {
  const [optimisticDeployed, setOptimisticDeployed] = useState(false);
  const [filters, setFilters] = useState(Array(STATUSES.length).fill(true));

  const { data: deploymentStatus } = useQuery({
    queryKey: [],
    queryFn: getDeploymentStatus,
    refetchInterval: 2000,
  });

  const { refetch: startDeploymentRefetch } = useQuery({
    queryKey: [],
    queryFn: startDeploy,
    enabled: false,
  });

  const handleStartDeployment = () => {
    setOptimisticDeployed(true);
    startDeploymentRefetch();
  };

  const handleStopDeployment = () => {
    setOptimisticDeployed(false);
  };

  const onDeploymentClick = () => {
    if (isRunning) {
      handleStopDeployment();
      return;
    }

    handleStartDeployment();
  };

  const onResetFiltersClick = () => {
    setFilters(Array(STATUSES.length).fill(true));
  };

  const handleFilterChange = (filterIndex: number) => {
    const newFilters = [...filters];
    newFilters[filterIndex] = !newFilters[filterIndex];
    setFilters(newFilters);
  };

  const isRunning = deploymentStatus?.running ?? optimisticDeployed;
  const isRunningMessage = isRunning ? "Running" : "Not Running";
  const messageCount = STATUSES.reduce((total, s) => {
    return total + (deploymentStatus?.[s.value].length ?? 0);
  }, 0);

  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/deploy">All Topologies</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <SlashIcon />
          </BreadcrumbSeparator>
          {/* <BreadcrumbItem>
            <BreadcrumbPage>{topologyId}</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <SlashIcon />
          </BreadcrumbSeparator> */}
          <BreadcrumbItem>
            <BreadcrumbLink href="/deploy">Deploy</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex gap-4 items-center">
        <button
          type="button"
          onClick={onDeploymentClick}
          className={cn(
            "self-center text-lg text-white font-semibold px-4 py-2 hover:opacity-80 hover:shadow-md cursor-pointer w-48",
            isRunning ? "bg-red-700" : "bg-blue-800",
          )}
        >
          {isRunning ? "Stop" : "Start"} Deployment
        </button>

        <div className="text-lg gap-2">
          <div className="flex gap-2 font-bold">
            Status:
            <span
              className={cn("", isRunning ? "text-green-700" : "text-red-700")}
            >
              {isRunningMessage}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 font-bold">
        <span className="text-lg self-center">Message Filters:</span>
        {STATUSES.map((statusType, i) => (
          <Button
            key={i}
            className={cn(
              "text-md hover:opacity-80 hover:shadow-md cursor-pointer",
              statusType.bgColor,
              statusType.borderColor,
              statusType.textColor,
              !filters[i] && "opacity-50",
            )}
            onClick={() => handleFilterChange(i)}
          >
            {statusType.name} (
            {deploymentStatus?.[statusType.value].length ?? 0})
          </Button>
        ))}
        <Button
          type="button"
          className="cursor-pointer"
          variant="ghost"
          onClick={onResetFiltersClick}
        >
          Reset
        </Button>
      </div>

      <div className="border-1" />

      <div className="text-lg font-bold">{messageCount} Messages:</div>
      <div className="flex flex-col gap-1">
        {filters[0] &&
          deploymentStatus?.successes.map((message, mi) => (
            <div
              key={mi}
              className={cn(
                "px-4 py-2 border-l-6",
                STATUSES[0].bgColor,
                STATUSES[0].borderColor,
              )}
            >
              <div
                className={cn(
                  "flex self-end gap-2 font-semibold pb-1",
                  STATUSES[0].textColor,
                )}
              >
                <Check />
                {STATUSES[0].header}
              </div>
              <div className="flex gap-2">
                <span className="font-semibold">{message.name}</span>
                <span className="">(ID: {message.id})</span>
              </div>
            </div>
          ))}

        {STATUSES.slice(1).map((statusType, si) => (
          <React.Fragment key={si}>
            {filters[si + 1] &&
              deploymentStatus?.[statusType.value].map((message, mi) => (
                <div
                  key={mi}
                  className={cn(
                    "px-4 py-2 border-l-6",
                    statusType.bgColor,
                    statusType.borderColor,
                  )}
                >
                  <div
                    className={cn(
                      "flex self-end gap-2 font-semibold pb-1",
                      statusType.textColor,
                    )}
                  >
                    <statusType.iconElement />
                    {statusType.header}
                  </div>
                  <span>{message as string}</span>
                </div>
              ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
