import React from 'react';
import { equals } from 'ramda';
import { ApiError } from '../error';
function hasObjectPrototype(o: any): boolean {
	return Object.prototype.toString.call(o) === '[object Object]';
}

function isPlainObject(o: any): o is Object {
	if (!hasObjectPrototype(o)) {
		return false;
	}

	// If has modified constructor
	const ctor = o.constructor;
	if (typeof ctor === 'undefined') {
		return true;
	}

	// If has modified prototype
	const prot = ctor.prototype;
	if (!hasObjectPrototype(prot)) {
		return false;
	}

	// If constructor does not have an Object-specific method
	if (!prot.hasOwnProperty('isPrototypeOf')) {
		return false;
	}

	// Most likely a plain Object
	return true;
}

export function stableValueHash(value: React.DependencyList): string {
	return JSON.stringify(value, (_, val) =>
		isPlainObject(val)
			? Object.keys(val)
					.sort()
					.reduce((result, key) => {
						result[key] = val[key];
						return result;
					}, {} as any)
			: val
	);
}
export const getApiError = <T extends ApiError>(e: T | null): string => {
	if (e === null) return '';
	const fields = e?.fields;
	return (
		fields?.length
			? Array.isArray(fields[0].error)
				? fields[0].error[0]
				: fields[0].error
			: e?.message || 'Something went wrong'
	) as string;
};

type UseEffectParams = Parameters<typeof React.useEffect>;
type EffectCallback = UseEffectParams[0];
type DependencyList = UseEffectParams[1];
type UseEffectReturn = ReturnType<typeof React.useEffect>;
export function useDeepCompareEffect(callback: EffectCallback, dependencies: DependencyList): UseEffectReturn {
	// eslint-disable-next-line react-hooks/exhaustive-deps
	return React.useEffect(callback, useDeepCompareMemoize(dependencies));
}
export function useDeepCompareMemoize(value: DependencyList) {
	const ref = React.useRef<DependencyList>();
	const signalRef = React.useRef<number>(0);

	if (!equals(value, ref.current)) {
		ref.current = value;
		signalRef.current += 1;
	}

	return [signalRef.current];
}
