/**
 * Get the Carthage API URL, working in both browser and Node.js environments.
 *
 * VITE_CARTHAGE_API_URL should be a full URL like http://127.0.0.1:8080/
 */
export const getCarthageApiUrl = (): string => {
  // Check if running in Node.js environment
  const isNode =
    typeof process !== "undefined" &&
    process.versions != null &&
    process.versions.node != null;

  if (isNode) {
    const rawUrl = process.env.VITE_CARTHAGE_API_URL;

    if (!rawUrl) {
      throw new Error(
        "'VITE_CARTHAGE_API_URL' not found in environment variables!",
      );
    }

    return `${rawUrl.replace(/\/$/, "")}/api/v1`;
  }

  if (import.meta.env.DEV) {
    const rawUrl = import.meta.env.VITE_CARTHAGE_API_URL || "";

    if (!rawUrl) {
      throw new Error("'VITE_CARTHAGE_API_URL' not found in .env!");
    }

    return `${rawUrl.replace(/\/$/, "")}/api/v1`;
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
