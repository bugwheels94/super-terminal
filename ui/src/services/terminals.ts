import { UseMutationOptions, useMutation } from 'react-query';
import { ApiError } from '../utils/error';
import { fetchSocket } from '../utils/fetch';
import { useMutationPlus } from '../utils/reactQueryPlus/mutation';
import { useQueryPlus } from '../utils/reactQueryPlus/query';
import { addPrefixIfNotEmpty } from '../utils/string';

export type Terminal = {
	id: number;
	height: number | null;
	width: number | null;
	x: number | null;
	y: number | null;
	logs?: {
		log: string;
	}[];
	title?: string;
	mainCommand?: string;
	startupCommands?: string;
	startupEnvironmentVariables?: string;
	cwd?: string;
};
export type TerminalCommand = {
	terminalId: number;
	command: string;
};
export type PostTerminalRequest = {
	projectSlug: string;
};
export type PatchTerminalRequest = Partial<Omit<Terminal, 'id'>> & {
	restart?: true;
	meta?: {
		rows: number;
		cols: number;
	};
};
type CloneTerminalRequest = {
	id: number;
};

export const getTerminalQueryKey = (projectId: number, terminalId?: number | string) =>
	`/projects/${projectId}/terminals${addPrefixIfNotEmpty(terminalId, '/')}`;
export const getTerminalCommandsQueryKey = (terminalId: number, query?: string) =>
	`/terminals${addPrefixIfNotEmpty(terminalId, '/')}${addPrefixIfNotEmpty(query, '/')}`;
export const useGetTerminals = (projectId: number, options = {}) => {
	return useQueryPlus<Terminal[], ApiError>(
		getTerminalQueryKey(projectId),
		() =>
			fetchSocket<Terminal[]>(`/projects/${projectId}/terminals`, {
				method: 'get',
			}).then((d) => {
				return d;
			}),
		options
	);
};
export const useGetTerminalCommands = (terminalId: number, query: string, options: {}) => {
	return useQueryPlus<TerminalCommand[], ApiError>(
		getTerminalCommandsQueryKey(terminalId, query),
		() =>
			fetchSocket<TerminalCommand[]>(`/terminals/${terminalId}/terminal-commands/${query}`, {
				method: 'get',
			}),
		{
			retry: (_, error) => {
				if (error.status === 401) return false;
				return true;
			},
			enabled: !!query,
			...options,
		}
	);
};

export const usePostTerminal = (id: number) => {
	return useMutationPlus<Terminal, {}, ApiError>(getTerminalQueryKey(id), (body) =>
		fetchSocket<Terminal>(`/projects/${id}/terminals`, {
			body,
			method: 'post',
		})
	);
};
export const useCloneTerminal = (
	projectId: number,
	options: UseMutationOptions<Terminal, ApiError, CloneTerminalRequest> = {}
) => {
	return useMutationPlus<Terminal, CloneTerminalRequest, ApiError>(
		getTerminalQueryKey(projectId, `terminal/copies`),
		(body) =>
			fetchSocket<Terminal>(`/projects/${projectId}/terminals/${body.id}/copies`, {
				body,
				method: 'post',
			}),
		{
			retry: (_, error) => {
				if (error.status === 401) return false;
				return true;
			},
			...options,
			onSuccess: (data, ...rest) => {
				if (options.onSuccess) options.onSuccess(data, ...rest);
			},
		}
	);
};
export const usePatchTerminal = (
	projectId: number,
	id: number,
	options: UseMutationOptions<Terminal, ApiError, PatchTerminalRequest> = {}
) => {
	return useMutation(
		(body) =>
			fetchSocket(`/projects/${projectId}/terminals/${id}`, {
				body,
				method: 'patch',
			}),
		{
			...options,
		}
	);
};
export const useDeleteTerminal = (
	projectId: number,
	id: number,
	options: UseMutationOptions<unknown, ApiError> = {}
) => {
	return useMutationPlus(
		getTerminalQueryKey(projectId, id),
		() =>
			fetchSocket(`/projects/${projectId}/terminals/${id}`, {
				method: 'delete',
			}),
		{
			retry: (_, error) => {
				if (error.status === 401) return false;
				return true;
			},
			...options,
			onSuccess: (data, variables, c) => {
				if (options.onSuccess) options.onSuccess(data, variables, c);
			},
		}
	);
};
