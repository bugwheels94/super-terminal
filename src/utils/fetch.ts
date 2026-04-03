import { ApiError } from './error';
import { ws } from './socket';

type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
interface JSONObject {
	[key: string]: JSONValue;
}
interface JSONArray extends Array<JSONValue> {}

let id = -1;
let store: Record<number, any> = {};

ws.addEventListener('message', ({ detail }) => {
	try {
		if (typeof detail === 'string') {
			const message = JSON.parse(detail);
			if (store[message.id]) {
				if (message.error) store[message.id].reject(new ApiError(message.error, 500));
				else store[message.id].resolve(message.data);
				delete store[message.id];
			}
		}
	} catch (e) {}
});
export const fetchSocket = async <T>(name: string, { data = {}, namespace = '', forget = false }): Promise<T> => {
	try {
		ws.send(JSON.stringify({ name, namespace, data, id: ++id }));
		// ws.send(encodeClientMessage(name, namespace, data, id++));
		// @ts-ignore
		if (forget) return;
		return new Promise((resolve, reject) => {
			store[id] = { resolve, reject };
		});
	} catch (e) {
		// @ts-ignore
		if (typeof e === 'object' && e !== null) throw new ApiError(e.data, e.status);
		else throw e;
	}
};
