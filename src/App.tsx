import type { SyncManager, SyncRegistry } from "entanglement-core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { EntanglementProvider } from "entanglement-react";
import { useEffect, useState } from "react";
import { AppSidebar } from "./components/features/AppSidebar";
import { createEntanglementProps } from "./entanglement";
import router from "./router";

const queryClient = new QueryClient();

function App() {
  const [entanglement, setEntanglement] = useState<{
    manager: SyncManager;
    registry: SyncRegistry;
  } | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    createEntanglementProps()
      .then((props) => setEntanglement(props))
      .catch((err) =>
        setError(err instanceof Error ? err : new Error(String(err))),
      );
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-destructive/10">
        <div className="p-6 bg-destructive text-background rounded-lg max-w-lg">
          <h2 className="text-xl font-bold mb-2">Failed to initialize</h2>
          <p className="text-sm mb-4">{error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-background text-destructive rounded hover:opacity-90"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  if (!entanglement) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <EntanglementProvider
        manager={entanglement.manager}
        registry={entanglement.registry}
      >
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
