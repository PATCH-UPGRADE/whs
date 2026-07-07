const getCarthageApiUrl = (): string => {
  if (import.meta.env.DEV) {
    const CARTHAGE_API_URL = import.meta.env.VITE_CARTHAGE_API_URL;

    if (!CARTHAGE_API_URL) {
      throw new Error("'VITE_CARTHAGE_API_URL' not found in .env!");
    }

    return `http://${CARTHAGE_API_URL}`;
  }

  const { protocol, hostname, port } = window.location;
  const portSuffix = port ? `:${port}` : "";
  return `${protocol}//${hostname}${portSuffix}/api/v1`;
};

const CARTHAGE_API_URL = getCarthageApiUrl();

export const carthageFetcher = async <T>(
  endpointUrl: string,
  options?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${CARTHAGE_API_URL}${endpointUrl}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    cache: "no-store", // let react-query handle caching
    ...options,
  });

  if (!response.ok) {
    throw new Error(`An HTTP error occured: ${response.status}`);
  }

  return response.json();
};

// explicitly leave off the content-type so the browser can determine it
// ^ this is necessary for file uploads with extra fields to work
export const carthageFetcherUpload = async <T>(
  endpointUrl: string,
  options?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${CARTHAGE_API_URL}${endpointUrl}`, {
    headers: {
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`An HTTP error occured: ${response.status}`);
  }

  return response.json();
};
