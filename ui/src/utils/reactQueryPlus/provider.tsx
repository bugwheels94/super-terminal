import React, { ReactNode, Reducer, useContext, useMemo, useReducer, useState } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

export const ReactQueryPlusSetter = React.createContext<React.Dispatch<{ type?: string; value: any; hash: string }>>(
	() => {}
);
export const ReactQueryPlusGetter = React.createContext<MyState>({
	errors: [],
	loading: [],
	fetching: [],
});
interface MyState {
	errors: {
		hash: string;
		value: any;
	}[];
	loading: string[];
	fetching: string[];
}
const newProgressList = (hash: string, list: string[], isProgress: boolean) => {
	if (isProgress) return [...list, hash];
	return list.filter((existingHash) => existingHash !== hash);
};
export const ReactQueryPlusProvider = ({ children }: { children: ReactNode }) => {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						refetchOnMount: true,
						refetchOnWindowFocus: false,
					},
				},
			})
	);

	const [state, setState] = useReducer<Reducer<MyState, { type?: string; value: any; hash: string }>>(
		(state, action) => {
			switch (action.type) {
				case 'loading':
					return { ...state, loading: newProgressList(action.hash, state.loading, action.value) };
				case 'fetching':
					return { ...state, fetching: newProgressList(action.hash, state.fetching, action.value) };
				case 'error':
					if (action.value) {
						return { ...state, errors: [...state.errors, action] };
					}
					return { ...state, errors: state.errors?.filter((error) => error.hash !== action.hash) };
				default:
					return { ...state, ...action };
			}
		},
		{ errors: [], loading: [], fetching: [] }
	);

	return (
		<ReactQueryPlusSetter.Provider value={setState}>
			<ReactQueryPlusGetter.Provider value={state}>
				<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
			</ReactQueryPlusGetter.Provider>
		</ReactQueryPlusSetter.Provider>
	);
};
export const useReactQueryPlusGetter = () => {
	return useContext(ReactQueryPlusGetter);
};
export const useReactQueryPlusSetter = () => {
	return useContext(ReactQueryPlusSetter);
};
export const useIsLoading = () => {
	const state = useContext(ReactQueryPlusGetter);
	return useMemo(() => !!state.loading.length, [state.loading]);
};
export const useIsFetching = () => {
	const state = useContext(ReactQueryPlusGetter);
	return useMemo(() => !!state.fetching.length, [state.fetching]);
};
export const useIsError = () => {
	const state = useContext(ReactQueryPlusGetter);
	const setState = useContext(ReactQueryPlusSetter);
	return useMemo(() => {
		return {
			errors: state.errors,
			reset: (hash: string) =>
				setState({
					type: 'error',
					value: null,
					hash,
				}),
		};
	}, [setState, state.errors]);
};
