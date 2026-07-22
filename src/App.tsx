import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "./components/features/AppSidebar";
import router from "./router";
import { createEntanglementProps } from "./entanglement";
import { EntanglementProvider } from "entanglement-react";

const queryClient = new QueryClient();

function App() {
  const [entanglement, setEntanglement] = useState<{ manager: any; registry: any } | null>(null);

  useEffect(() => {
    createEntanglementProps().then((props) => setEntanglement(props));
  }, []);

  if (!entanglement) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <EntanglementProvider manager={entanglement.manager} registry={entanglement.registry}>
        <div className="flex w-full h-full">
          <AppSidebar />
          <div className="ml-64 flex flex-col w-full h-full p-16">
            <RouterProvider router={router} />
          </div>
        </div>
      </EntanglementProvider>
    </QueryClientProvider>
  );
}

export default App;
