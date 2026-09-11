import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getViewer } from "./bidshield.functions";

export type Viewer = Awaited<ReturnType<typeof getViewer>>;

export function useViewer() {
  const fn = useServerFn(getViewer);
  return useQuery({
    queryKey: ["viewer"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}

export function can(viewer: Viewer | undefined, permission: string) {
  return Boolean(viewer?.permissions.includes(permission));
}

/** True when the failure came from a server-side permission gate. */
export function isForbidden(error: unknown) {
  return error instanceof Error && error.message.includes("FORBIDDEN");
}
