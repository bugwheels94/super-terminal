import { UseMutationOptions, useMutation, useQueryClient } from 'react-query';
import { ITheme } from 'xterm';
import { fetchSocket } from '../utils/fetch';
import { useMutationPlus } from '../utils/reactQueryPlus/mutation';
import { useQueryPlus } from '../utils/reactQueryPlus/query';
import { ApiError } from '../utils/error';

export type Project = {
	slug: string;
	id: number;
	terminalTheme?: ITheme;
	fontSize?: number;
	terminalLayout: 'automatic' | 'manual';
	scrollback?: number;
};

export type PostProjectRequest = Omit<Project, 'id'>;
export type PatchProjectRequest = Partial<Project>;
export const getProjectQueryKey = (id: number) => `/projects/${id}`;
export const getProjectsQueryKey = () => `/projects`;

export const usePatchProject = (
	projectId: number,
	options: UseMutationOptions<Project, ApiError, PatchProjectRequest> = {}
) => {
	return useMutationPlus<Project, PatchProjectRequest>(
		getProjectQueryKey(projectId),
		(body) =>
			fetchSocket<Project>(`/projects/${projectId}`, {
				method: 'patch',
				body: body as any,
			}).catch(),
		options
	);
};

export const useGetProjects = () => {
	return useQueryPlus(
		getProjectsQueryKey(),
		() =>
			fetchSocket<Project[]>(`/projects`, {
				body: '',
				method: 'get',
			}),
		{ refetchOnMount: true }
	);
};
export const usePutProject = (projectSlug: string) => {
	const queryClient = useQueryClient();
	return useQueryPlus<number>(
		`/projects/${projectSlug}`,
		() =>
			fetchSocket<number>(`/projects/${projectSlug}`, {
				method: 'put',
				body: {},
			}),
		{
			keepPreviousData: true,
			onSuccess: () => {
				queryClient.invalidateQueries(getProjectsQueryKey());
			},
		}
	);
};
export const useGetProject = (id?: number) => {
	return useQueryPlus(
		getProjectQueryKey(id || -1),
		() =>
			fetchSocket<Project>(`/projects/${id}`, {
				method: 'get',
				body: {},
			}),
		{ enabled: id !== undefined, keepPreviousData: true }
	);
};

export const useDeleteProject = (id: number) => {
	return useMutationPlus<'OK'>(getProjectQueryKey(id), () =>
		fetchSocket(`/projects/${id}`, {
			method: 'delete',
		})
	);
};
export const useGetRunningProjects = () => {
	return useQueryPlus(
		'/running-projects',
		() =>
			fetchSocket<number[]>(`/running-projects`, {
				method: 'get',
				body: {},
			}),
		{
			initialData: [],
		}
	);
};
export const useDeleteProjectRunningStatus = (projectId: number, options: UseMutationOptions<Project, ApiError>) => {
	return useMutation(
		() =>
			fetchSocket<Project>(`/projects/${projectId}/running-status`, {
				method: 'delete',
				body: {},
			}),
		options
	);
};
