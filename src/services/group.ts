import { fetchSocket } from '../utils/fetch';
import { useMutationPlus } from '../utils/reactQueryPlus/mutation';

export const useDeleteProjectLogs = (projectId: number) => {
	return useMutationPlus<unknown>(`/project-logs/${projectId}`, () =>
		fetchSocket(`delete:project-logs`, {
			data: { projectId },
			namespace: 'project',
			forget: true,
		})
	);
};
