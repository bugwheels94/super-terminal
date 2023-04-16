export function capitalizeFirstLetter(string: string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}
export function pascalToSentence(string: string) {
	return string.replace(/([a-z])([A-Z])/g, '$1 $2');
}
export const pluralizeIfNeeded = (count: number | undefined, noun: string, suffix = 's') =>
	`${count} ${noun}${count !== 1 ? suffix : ''}`;

export const chunkify = (s: string = '') => {
	const str = '' + s;
	const chunks: string[] = [];
	const temp = str.slice(0, 30).split(' ');
	let current = '';
	for (let i = 0; i < temp.length; i++) {
		if (current.length + temp[i].length >= 20) {
			chunks.push(current);
			current = '';
		}
		current += temp[i] + ' ';
	}
	if (str.length > 30) current += '...';
	chunks.push(current);
	return chunks;
};
export const truncate = (s: string, n: number) => {
	const str = '' + s;
	return str.length > n ? `${str.slice(0, 30)}...` : str;
};
export const addPrefixIfNotEmpty = (string: number | string | undefined, prefix: string | number) => {
	return string ? `${prefix}${string}` : '';
};
