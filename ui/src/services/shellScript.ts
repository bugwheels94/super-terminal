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
		fetchSocket(`patch:script`, {
			data: {
				scriptId,
				projectId,
				script: body,
			},
		})
	);
};
export const useGetProjectScripts = (projectId: number) => {
	return useQueryPlus(
		getProjectScriptQueryKey(projectId),
		async () => {
			try {
				const d = fetchSocket<ShellScript[]>(`get:scripts`, {
					data: projectId,
				});
				return d;
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
		fetchSocket(`post:script`, {
			data: {
				projectId,
				...body,
			},
		})
	);
};
export const useCloneProjectScript = (projectId: number, scriptId: number) => {
	return useMutationPlus<null, PostShellScript>(getProjectScriptCopyQueryKey(projectId, scriptId), () =>
		fetchSocket(`clone:script`, {
			data: {
				scriptId: scriptId,
				projectId,
			},
		})
	);
};
export const usePostProjectScriptExecution = (terminalId: number, scriptId: number) => {
	return useMutationPlus<null, Record<string, unknown>>(
		getTerminalScriptExecutionQueryKey(terminalId, scriptId),
		(body) =>
			fetchSocket(`execute:script`, {
				data: {
					scriptId,
					terminalId,
					parameters: body,
				},
			})
	);
};

export const useDeleteProjectScript = (projectId: number, scriptId: number) => {
	return useMutationPlus(getProjectScriptQueryKey(projectId, scriptId), () =>
		fetchSocket(`delete:script`, {
			data: { scriptId, projectId },
		})
	);
};
