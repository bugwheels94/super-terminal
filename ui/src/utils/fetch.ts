import { ClientRequest } from 'restify-websocket/client';
import { ApiError } from './error';
import { client } from './socket';

export const fetchSocket = async <T>(
	url: string,
	{ method = 'get', body = {} }: ClientRequest & { method: 'get' | 'put' | 'post' | 'delete' | 'patch' }
): Promise<T> => {
	try {
		const result = client[method](url, {
			body,
		});
		return (await result).data as unknown as T;
	} catch (e) {
		// @ts-ignore
		if (typeof e === 'object' && e !== null) throw new ApiError(e.data, e.status);
		throw e;
	}
};
