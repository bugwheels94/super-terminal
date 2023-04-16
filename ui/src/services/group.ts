import { fetchSocket } from '../utils/fetch';
import { useMutationPlus } from '../utils/reactQueryPlus/mutation';

export const usePutSocketGroup = (projectId: number) => {
	return useMutationPlus('/groups', () =>
		fetchSocket(`/groups/${projectId}`, {
			method: 'put',
		})
	);
};
// should be in separate file
export const useDeleteLogsArchive = () => {
	return useMutationPlus<unknown, { days: number }>('/logs-archive', (body) =>
		fetchSocket(`/logs-archive/${body.days}`, {
			method: 'delete',
		})
	);
};
