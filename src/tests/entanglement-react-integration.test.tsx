// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { SyncOwner } from "entanglement-core/persistence";
import { EntanglementProvider, useEntangledList } from "entanglement-react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { getCarthageApiUrl } from "@/fetcher";
import { createEntanglementProps } from "../entanglement";

const CARTHAGE_API_URL = getCarthageApiUrl();

const skipTests = !CARTHAGE_API_URL || !new URL(CARTHAGE_API_URL).hostname;

describe("Entanglement React Integration", () => {
  let entanglementProps: Awaited<
    ReturnType<typeof createEntanglementProps>
  > | null = null;

  beforeAll(async () => {
    if (skipTests) {
      console.log("SKIPPED: VITE_CARTHAGE_API_URL not configured");
      return;
    }

    entanglementProps = await createEntanglementProps();
    console.log(`Connected to WebSocket: ${entanglementProps.manager.url}`);
  });

  it("should receive at least one SyncOwner via WebSocket using useEntangledList", async () => {
    if (skipTests || !entanglementProps) return;

    const { manager, registry } = entanglementProps;

    const wrapper = ({ children }: { children: ReactNode }) => (
      <EntanglementProvider manager={manager} registry={registry}>
        {children}
      </EntanglementProvider>
    );

    const { result } = renderHook(() => useEntangledList(SyncOwner), {
      wrapper,
    });

    await waitFor(() => expect(result.current.length).toBeGreaterThan(0), {
      timeout: 5000,
    });
  }, 30000); // Timeout: 30 seconds

  it("should have SyncOwner in syncStorageMap within 5 seconds", async () => {
    if (skipTests || !entanglementProps) return;

    await waitFor(
      () => {
        const map = SyncOwner.syncStorageMap;
        expect(map.size).toBeGreaterThan(0);
      },
      {
        timeout: 5000,
      },
    );
  }, 30000); // Timeout: 30 seconds
});
