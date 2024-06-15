type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
interface JSONObject {
	[key: string]: JSONValue;
}
interface JSONArray extends Array<JSONValue> {}

interface IdObject {
	id: number;
	error: string;
	data?: JSONValue;
}

interface NameObject {
	name: string;
	data: JSONValue;
}

type EncodableObject = IdObject | NameObject;

function encodeClientMessage(obj: EncodableObject): Uint8Array {
	const encoder = new TextEncoder();
	let totalLength = 2; // PRESENT FIELDS
	let nameBytes: Uint8Array | undefined;
	let dataBytes: Uint8Array = new Uint8Array(0);
	// ID always fixed at 65535 max
	// [ID_PRESENT = 0/NAME_PRESENT = 1][ID][NAME_LENGTH][NAME][ERROR_PRESENT = 0/DATA_PRESENT = 1][ERROR/DATA]
	// Encode id if present
	if ('id' in obj) {
		totalLength += 2;
	} else {
		nameBytes = encoder.encode(obj.name);
		totalLength += nameBytes.length;
		const dataStr = typeof obj.data === 'string' ? obj.data : JSON.stringify(obj.data);
		const dataBytes = encoder.encode(dataStr);
		totalLength += dataBytes.length + 1;
	}
	if ('error' in obj) {
		dataBytes = encoder.encode(obj.error);
		totalLength += dataBytes.length;
	} else if ('data' in obj) {
		if (obj.data instanceof Uint8Array) {
			dataBytes = obj.data;
		} else if (typeof obj.data === 'object') {
			dataBytes = encoder.encode(JSON.stringify(obj.data));
		} else {
			dataBytes = encoder.encode(obj.data + '');
		}
		totalLength += dataBytes.length;
	}
	// Create a Uint8Array to hold the entire message
	const message = new Uint8Array(totalLength); // Add 4 bytes for length prefixes
	let offset = 0;

	// Encode lengths of id, name, error, and data
	if ('id' in obj) {
		message[offset++] = 0;
		offset++;
		message[offset++] = obj.id & 0xff;
		message[offset++] = obj.id >> 8;
	} else if (nameBytes) {
		message[offset++] = 1;
		message[offset++] = nameBytes.length || 0;
		message.set(nameBytes, offset);
		offset += nameBytes.length;
	}
	if ('error' in obj) {
		message[offset++] = 0;
	} else message[offset++] = 1;
	message.set(dataBytes, offset);

	return message;
}

// // Example usage
// const obj1: EncodableObject = { id: 123, error: "An error occurred", data: { key: "value" } };
// const encodedMessage1 = encodeObjectToUint8Array(obj1);
// console.log(encodedMessage1);

// const obj2: EncodableObject = { name: "John Doe", data: "Some data" };
// const encodedMessage2 = encodeObjectToUint8Array(obj2);
// console.log(encodedMessage2);

// // This will throw an error
// // const obj3: EncodableObject = { name: "Jane Doe", error: "Another error" };
// // const encodedMessage3 = encodeObjectToUint8Array(obj3);
