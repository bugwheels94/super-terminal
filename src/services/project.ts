import { UseMutationOptions, useMutation } from "@tanstack/react-query";
import { ITheme } from "xterm";
import { fetchSocket } from "../utils/fetch";
import { useMutationPlus } from "../utils/reactQueryPlus/mutation";
import { useQueryPlus } from "../utils/reactQueryPlus/query";
import { ApiError } from "../utils/error";

export type Project = {
  slug: string;
  id: number;
  terminalTheme?: ITheme;
  fontSize?: number;
  terminalLayout: "automatic" | "manual";
  scrollback?: number;
  maxLogSizeMb?: number | null;
};

export type PostProjectRequest = Omit<Project, "id">;
export type PatchProjectRequest = Partial<Project>;
export const getProjectQueryKey = (id: number) => `/projects/${id}`;
export const getProjectsQueryKey = () => `/projects`;

export const usePatchProject = (
  projectId: number,
  options: UseMutationOptions<Project, ApiError, PatchProjectRequest> = {},
) => {
  return useMutationPlus<Project, PatchProjectRequest>(
    getProjectQueryKey(projectId),
    (body) =>
      fetchSocket<Project>(`patch:project`, {
        data: { project: body as any, id: projectId },
        namespace: "project",
      }).catch(),
    options,
  );
};

export const useGetProjects = () => {
  return useQueryPlus(
    getProjectsQueryKey(),
    () =>
      fetchSocket<Project[]>(`get:projects`, {
        namespace: "project",
      }),
    {
      refetchOnMount: true,
    },
  );
};
export const usePutProject = (projectSlug: string) => {
  return useQueryPlus<number>(
    `/projects/${projectSlug}`,
    () =>
      fetchSocket<number>(`put:project`, {
        data: projectSlug,
        namespace: "project",
      }),
    {
      placeholderData: (prev: any) => prev,
    },
  );
};
export const useGetProject = (id?: number) => {
  return useQueryPlus(
    getProjectQueryKey(id || -1),
    () =>
      fetchSocket<Project>(`get:project`, {
        namespace: "project",
        data: id,
      }),
    { enabled: id !== undefined, placeholderData: (prev: any) => prev },
  );
};

export const useDeleteProject = (id: number) => {
  return useMutationPlus<"OK">(getProjectQueryKey(id), () =>
    fetchSocket(`delete:project`, {
      namespace: "project",
      data: id,
    }),
  );
};
export const useGetRunningProjects = () => {
  return useQueryPlus(
    "/running-projects",
    () =>
      fetchSocket<number[]>(`get:running-projects`, {
        namespace: "project",
      }),
    {
      initialData: [],
    },
  );
};
export const useDeleteProjectRunningStatus = (
  projectId: number,
  options: UseMutationOptions<Project, ApiError>,
) => {
  return useMutation({
    mutationFn: () =>
      fetchSocket<Project>(`close:running-projects`, {
        data: projectId,
        namespace: "project",
      }),
    ...options,
  });
};
