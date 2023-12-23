import { useEffect, useMemo } from 'react';
import { QueryFunction, QueryKey, useQuery, UseQueryOptions, UseQueryResult } from 'react-query';
import { getApiError, useDeepCompareMemoize } from './utils';
import { useReactQueryPlusSetter } from './provider';
import { stableValueHash } from './utils';
import { capitalizeFirstLetter, pascalToSentence } from '../string';
import { ApiError } from '../error';

export const useQueryPlus = <
	PromiseResolutionData = unknown,
	TError extends ApiError = ApiError,
	SelectedData = PromiseResolutionData,
	TQueryKey extends QueryKey = QueryKey
>(
	queryKey: TQueryKey,
	queryFn: QueryFunction<PromiseResolutionData, TQueryKey>,
	options: Omit<UseQueryOptions<PromiseResolutionData, TError, SelectedData, TQueryKey>, 'queryKey'> & {
		hideGlobalLoader?: boolean;
		hideGlobalError?: boolean;
		hideGlobalFetcher?: boolean;
	} = {}
): UseQueryResult<SelectedData, TError> => {
	const actualKey = Array.isArray(queryKey) ? queryKey.concat('query') : [queryKey, 'query'];
	const temp = useDeepCompareMemoize(actualKey);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const hash = useMemo(() => stableValueHash(actualKey), temp);
	const { hideGlobalError, hideGlobalLoader, hideGlobalFetcher, ...reactQueryOptions } = options;
	const setState = useReactQueryPlusSetter();
	const result = useQuery<PromiseResolutionData, TError, SelectedData, TQueryKey>({
		queryKey,
		queryFn,

		retry: (_, error) => {
			if (error.status >= 400 && error.status <= 500) return false;
			return true;
		},
		...reactQueryOptions,
	});
	useEffect(() => {
		if (hideGlobalLoader) return;
		setState({
			type: 'loading',
			hash,
			value: result.isLoading,
		});
		return () => {
			result.isLoading &&
				setState({
					type: 'loading',
					hash,
					value: false,
				});
		};
	}, [hash, hideGlobalLoader, result.isLoading, setState]);
	useEffect(() => {
		if (hideGlobalFetcher) return;
		setState({
			type: 'fetching',
			hash,
			value: result.isFetching,
		});
		return () => {
			result.isFetching &&
				setState({
					type: 'fetching',
					hash,
					value: false,
				});
		};
	}, [hash, hideGlobalFetcher, result.isFetching, setState]);
	useEffect(() => {
		if (hideGlobalError || result.error?.status === 404) return;
		setState({
			type: 'error',
			hash,
			value: capitalizeFirstLetter(pascalToSentence(getApiError(result.error))),
		});
	}, [hash, hideGlobalError, result.error, setState]);
	return result;
};
