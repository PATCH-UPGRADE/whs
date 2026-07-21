import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { AppSidebar } from "./components/features/AppSidebar";
import router from "./router";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex w-full h-full">
        <AppSidebar />
        <div className="ml-64 flex flex-col w-full h-full p-16">
          <RouterProvider router={router} />
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default App;
