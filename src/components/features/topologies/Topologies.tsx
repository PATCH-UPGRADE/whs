import { Link } from "@tanstack/react-router";
import { SlashIcon } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const TopologiesContainer = () => {
  return (
    <div>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/topologies">All Topologies</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <SlashIcon />
          </BreadcrumbSeparator>
        </BreadcrumbList>
      </Breadcrumb>

      <TopologiesList />
    </div>
  );
};

const TopologiesList = () => {
  return (
    <div>
      <Link
        to={"/topologies/Flat %2F24"}
        className="text-lg font-semibold text-blue-700 hover:text-blue-800 underline hover:no-underline transition-colors duration-200"
      >
        Flat /24
      </Link>
    </div>
  );
};
