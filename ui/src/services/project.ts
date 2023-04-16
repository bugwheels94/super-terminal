import { UseMutationOptions, useQueryClient } from 'react-query';
import { ITheme } from 'xterm';
import { fetchSocket } from '../utils/fetch';
import { useMutationPlus } from '../utils/reactQueryPlus/mutation';
import { useQueryPlus } from '../utils/reactQueryPlus/query';
import { addPrefixIfNotEmpty } from '../utils/string';
import { ApiError } from '../utils/error';

export type Project = {
	slug: string;
	id: number;
	terminalTheme?: ITheme;
	fontSize?: number;
	terminalLayout: 'automatic' | 'manual';
};

export type PostProjectRequest = Omit<Project, 'id'>;
export type PatchProjectRequest = Partial<Project>;
export const getProjectQueryKey = (projectId?: number | string) => `/projects${addPrefixIfNotEmpty(projectId, '/')}`;

export const usePatchProject = (
	projectId: number,
	options: UseMutationOptions<Project, ApiError, PatchProjectRequest> = {}
) => {
	return useMutationPlus<Project, PatchProjectRequest>(
		getProjectQueryKey(projectId + '/patch'),
		(body) =>
			fetchSocket<Project>(`/projects/${projectId}`, {
				method: 'patch',
				body: body as any,
			}),
		options
	);
};
export const usePostProject = (options: UseMutationOptions<Project, ApiError, PostProjectRequest> = {}) => {
	return useMutationPlus<Project, PostProjectRequest>(
		getProjectQueryKey('post'),
		(body) =>
			fetchSocket<Project>(`/projects`, {
				method: 'post',
				body: body as any,
			}),
		options
	);
};
export const useGetProjects = () => {
	return useQueryPlus(getProjectQueryKey(), () =>
		fetchSocket<Project[]>(`/projects`, {
			body: '',
			method: 'get',
		})
	);
};
export const usePutProject = (projectSlug: string, projectId?: number) => {
	const queryClient = useQueryClient();
	return useQueryPlus(
		getProjectQueryKey(projectSlug),
		() =>
			fetchSocket<Project>(`/projects/${projectSlug}${projectId ? '/' + projectId : ''}`, {
				method: 'put',
				body: {},
			}),
		{
			onSuccess: (data) => {
				queryClient.setQueryData(getProjectQueryKey(data.id), data);
			},
		}
	);
};

export const useDeleteProject = () => {
	return useMutationPlus<'OK', { id: number }>(getProjectQueryKey(), ({ id }) =>
		fetchSocket(`/projects/${id}`, {
			method: 'delete',
		})
	);
};