export class ApiError extends Error {
	status: number;
	fields: { error: string[] | string; field: string }[] = [];
	// partialResponse will come below
	constructor(message: string | null, status: any, err?: Error) {
		super();
		const error = err === undefined ? Error.call(this, message || '') : err;
		this.name = error === err ? 'RunTimeError' : 'UserGeneratedError';
		this.message = message || '';
		if (typeof message === 'object' && message !== null) {
			this.message = message['message'];
			this.fields = message['fields'] || null;
		}
		this.stack = error.stack;
		this.status = status;
	}
}
