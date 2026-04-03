import { useMemo, useEffect } from "react";
import {
  MutationKey,
  MutationFunction,
  UseMutationOptions,
  UseMutationResult,
  useMutation,
} from "@tanstack/react-query";
import { ApiError } from "../error";
import { capitalizeFirstLetter, pascalToSentence } from "../string";
import { useReactQueryPlusSetter } from "./provider";
import { stableValueHash, getApiError, useDeepCompareMemoize } from "./utils";

export const useMutationPlus = <
  PromiseResolutionData = unknown,
  SentVariables = void,
  TError extends ApiError = ApiError,
  TContext = unknown,
>(
  queryKey: string | MutationKey,
  mutationFn: MutationFunction<PromiseResolutionData, SentVariables>,
  options: UseMutationOptions<PromiseResolutionData, TError, SentVariables, TContext> & {
    hideGlobalLoader?: boolean;
    hideGlobalError?: boolean;
  } = {},
): UseMutationResult<PromiseResolutionData, TError, SentVariables, TContext> => {
  const actualKey = Array.isArray(queryKey) ? queryKey.concat("mutation") : [queryKey, "mutation"];
  const temp = useDeepCompareMemoize(actualKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hash = useMemo(() => stableValueHash(actualKey), temp);
  const { hideGlobalError, hideGlobalLoader, ...reactMutationOptions } = options;
  const setState = useReactQueryPlusSetter();
  const result = useMutation<PromiseResolutionData, TError, SentVariables, TContext>({
    mutationKey: (Array.isArray(queryKey) ? queryKey : [queryKey]) as MutationKey,
    mutationFn,
    retry: (_, error) => {
      if (error.status >= 300 && error.status <= 500) return false;
      return true;
    },
    ...reactMutationOptions,
  });
  useEffect(() => {
    if (hideGlobalLoader) return;
    setState({
      type: "loading",
      hash,
      value: result.isPending,
    });
    return () => {
      result.isPending &&
        setState({
          type: "loading",
          hash,
          value: false,
        });
    };
  }, [hash, hideGlobalLoader, result.isPending, setState]);

  useEffect(() => {
    if (hideGlobalError) return;
    setState({
      type: "error",
      hash,
      value: capitalizeFirstLetter(pascalToSentence(getApiError(result.error))),
    });
  }, [hash, hideGlobalError, result.error, setState]);
  return result;
};
