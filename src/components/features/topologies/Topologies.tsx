import { useQuery } from "@tanstack/react-query";
import { Check, Equal, TriangleAlert, User } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDeploymentStatus, startDeploy } from "./hooks";
import type { TopologyStatusResponseStatus } from "./types";

type StatusFilter = {
  value: Exclude<keyof TopologyStatusResponseStatus, "running">;
  name: string;
  header: string;
  description: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconElement: typeof Check;
};

const STATUSES: StatusFilter[] = [
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
    value: "ignored",
    name: "Ignored",
    header: "IGNORED",
    description: "",
    bgColor: "bg-neutral-200",
    borderColor: "border-neutral-500",
    textColor: "text-neutral-900",
    iconElement: Equal,
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
];

export const DeployTopologyContainer = () => {
  const [optimisticDeployed, setOptimisticDeployed] = useState(false);
  const [filters, setFilters] = useState([true, true, true, true, true]);

  const { data: deploymentStatus } = useQuery({
    queryKey: [],
    queryFn: getDeploymentStatus,
    refetchInterval: 1000,
  });

  const { refetch } = useQuery({
    queryKey: [],
    queryFn: startDeploy,
    enabled: false,
  });

  const startDeployment = () => {
    setOptimisticDeployed(true);
    refetch();
  };

  const stopDeployment = () => {
    setOptimisticDeployed(false);
  };

  const handleFilterChange = (filterIndex: number) => {
    const newFilters = [...filters];
    newFilters[filterIndex] = !newFilters[filterIndex];
    setFilters(newFilters);
  };

  const isRunning = deploymentStatus?.running ?? optimisticDeployed;
  const isRunningMessage = isRunning ? "Running" : "Not Running";

  return (
    <div>
      <button
        type="button"
        onClick={() => (isRunning ? stopDeployment() : startDeployment())}
        className={cn(
          "mb-4 text-lg text-white font-semibold px-4 py-2 hover:opacity-90 hover:shadow-md cursor-pointer",
          isRunning ? "bg-red-700" : "bg-blue-800",
        )}
      >
        {isRunning ? "Stop" : "Start"} Deployment
      </button>

      <div className="flex flex-col gap-3">
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

        <div className="flex gap-2 font-bold">
          <span className="text-lg self-center">Filters:</span>
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
        </div>

        <div className="flex flex-col gap-1 border-2">
          {STATUSES.map((statusType, si) => (
            <>
              {filters[si] &&
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
                    {message}
                  </div>
                ))}
            </>
          ))}
        </div>
      </div>
    </div>
  );
};
