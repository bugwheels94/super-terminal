import { fetchSocket } from '../utils/fetch';
import { useMutationPlus } from '../utils/reactQueryPlus/mutation';

// should be in separate file
export const useDeleteLogsArchive = () => {
	return useMutationPlus<unknown, { days: number }>('/logs-archive', (body) =>
		fetchSocket(`delete:logs-archive`, {
			data: body.days,
		})
	);
};
