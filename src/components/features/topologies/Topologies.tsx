import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDeploymentStatus, startDeploy } from "./hooks";
import type { TopologyStatusResponseStatus } from "./types";

export const TopologiesContainer = () => {
  const [deployed, setDeployed] = useState(false);

  const { data: status } = useQuery({
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
    setDeployed(true);
    refetch();
  };

  return (
    <div>
      <Button
        onClick={() => startDeployment()}
        className={cn(
          "mb-4 text-lg p-4 bg-blue-800",
          deployed && "bg-gray-500",
        )}
        disabled={deployed}
      >
        Start
      </Button>
      <Button
        onClick={() => {}}
        className={cn(
          "mb-4 text-lg p-4 bg-red-700",
          !deployed && "bg-gray-500",
        )}
      >
        Stop
      </Button>

      <DeploymentStatusBlock status={status} deployed={deployed} />
    </div>
  );
};

interface DeploymentStatusBlockI {
  status: TopologyStatusResponseStatus | undefined;
  deployed: boolean;
}

const DeploymentStatusBlock = ({
  status,
  deployed,
}: DeploymentStatusBlockI) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-lg gap-2">
        <div className="font-bold">Running:</div>
        <div className="pl-4">
          {status ? JSON.stringify(status.running) : deployed}
        </div>
      </div>

      <div className="text-lg gap-2">
        <div className="font-bold">Successes:</div>
        <div className="pl-4">
          {status ? JSON.stringify(status.successes) : "n/a"}
        </div>
      </div>

      <div className="text-lg gap-2">
        <div className="font-bold">Failures:</div>
        <div className="pl-4">
          {status ? JSON.stringify(status.failures) : "n/a"}
        </div>
      </div>

      <div className="text-lg gap-2">
        <div className="font-bold">Dependency Failures:</div>
        <div className="pl-4">
          {status ? JSON.stringify(status.dependency_failures) : "n/a"}
        </div>
      </div>

      <div className="text-lg gap-2">
        <div className="font-bold">Ignored:</div>
        <div className="pl-4">
          {status ? JSON.stringify(status.ignored) : "n/a"}
        </div>
      </div>

      <div className="text-lg gap-2">
        <div className="font-bold">Orphans:</div>
        <div className="pl-4">
          {status ? JSON.stringify(status.orphans) : "n/a"}
        </div>
      </div>
    </div>
  );
};
