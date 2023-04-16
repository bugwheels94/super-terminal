import { fetchSocket } from '../utils/fetch';
import { useMutationPlus } from '../utils/reactQueryPlus/mutation';
import { useQueryPlus } from '../utils/reactQueryPlus/query';
import { addPrefixIfNotEmpty } from '../utils/string';

export type ShellScript = {
	id: number;
	script: string;
	name: string;
	parameters: {
		name: string;
		type: 'manual' | 'pre-defined';
		possibleValues: string[];
	}[];
	projectId: number | null;
};
type PostShellScript = Partial<Omit<ShellScript, 'id'>>;
type PatchShellScript = Partial<PostShellScript>;

export const getProjectScriptQueryKey = (projectId: number, scriptId?: number) =>
	`/projects/${projectId}/${addPrefixIfNotEmpty(scriptId, 'scripts/')}`;
export const getProjectScriptCopyQueryKey = (projectId: number, scriptId?: number) =>
	`/projects/${projectId}/scripts/${scriptId}/copies`;
export const getTerminalScriptExecutionQueryKey = (terminalId: number, scriptId: number) =>
	`/terminals/${terminalId}/scripts/${scriptId}/executions`;

export const usePatchProjectScript = (projectId: number, scriptId: number) => {
	return useMutationPlus<null, PatchShellScript>(getProjectScriptQueryKey(projectId), (body) =>
		fetchSocket(`/projects/${projectId}/scripts/${scriptId}`, {
			method: 'patch',
			body: body as any,
		})
	);
};
export const useGetProjectScripts = (projectId: number) => {
	return useQueryPlus(
		getProjectScriptQueryKey(projectId),
		async () => {
			try {
				const d = fetchSocket<ShellScript[]>(`/projects/${projectId}/scripts`, {
					method: 'get',
				});
				return await d;
			} catch (e) {
				console.log(e);
			}
		},
		{
			refetchOnMount: true,
		}
	);
};
export const usePostProjectScript = (projectId: number) => {
	return useMutationPlus<null, PostShellScript>(getProjectScriptQueryKey(projectId), (body) =>
		fetchSocket(`/projects/${projectId}/scripts`, {
			method: 'post',
			body,
		})
	);
};
export const useCloneProjectScript = (projectId: number, scriptId: number) => {
	return useMutationPlus<null, PostShellScript>(getProjectScriptCopyQueryKey(projectId, scriptId), (body) =>
		fetchSocket(`/projects/${projectId}/scripts/${scriptId}/copies`, {
			method: 'post',
			body,
		})
	);
};
export const usePostProjectScriptExecution = (terminalId: number, scriptId: number) => {
	return useMutationPlus<null, Record<string, unknown>>(
		getTerminalScriptExecutionQueryKey(terminalId, scriptId),
		(body) =>
			fetchSocket(`/terminals/${terminalId}/scripts/${scriptId}/executions`, {
				method: 'post',
				body,
			})
	);
};

export const useDeleteProjectScript = (projectId: number, scriptId: number) => {
	return useMutationPlus(getProjectScriptQueryKey(projectId, scriptId), () =>
		fetchSocket(`/projects/${projectId}/scripts/${scriptId}`, {
			method: 'delete',
		})
	);
};
