import { isPlainObject } from "@reduxjs/toolkit";
import { FetchArgs, fetchBaseQuery as originalFetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { isApiError } from "..";
import { apiRequest } from "../apiUtils";

/**
 * These are the headers that redux passes to the fetch wrapper created by
 * fetchBaseQuery.
 */
type ReduxHeaders = NonNullable<FetchArgs["headers"]>;

/**
 * This exists because the redux helper has the wrong type. Alternatively, we
 * could have changed the return type of isPlainObject.
 */
function isHeaderObject(obj: ReduxHeaders): obj is Record<string, string | undefined> {
  return isPlainObject(obj);
}

function stripUndefined(headers: ReduxHeaders) {
  if (!isHeaderObject(headers)) {
    return headers ?? {};
  }

  const copy = { ...headers };

  Object.entries(copy).forEach(([k, v]) => {
    if (typeof v === "undefined") delete copy[k];
  });

  return copy as Record<string, string>;
}

type FetchWrapper = ReturnType<typeof originalFetchBaseQuery>;
type FetchWrapperOpts = Parameters<FetchWrapper>;
type FetchWrapperApiOpts = FetchWrapperOpts[1];

type ApiRequestOpts = Parameters<typeof apiRequest>;
type ApiRequestMethod = ApiRequestOpts[0];

type QueryParam = string | number;

/**
 * fetchBaseQuery returns a fetch-like wrapper that is used internally by Redux.
 *
 * **NOTE:** This version of fetchBaseQuery does not support responseHandler or
 * validateStatus. The reason is because apiRequest already performs this
 * functionality. See:
 * https://redux-toolkit.js.org/rtk-query/api/fetchBaseQuery#parsing-a-Response
 * and
 * https://redux-toolkit.js.org/rtk-query/api/fetchBaseQuery#handling-non-standard-response-status-codes
 */
export function fetchBaseQuery(baseOpts: {
  baseUrl: `/${string}/`;
  /**
   * Needed in order to transform query params into a search URL.
   * In manage, use `lib/url/buildQueryParams`.
   */
  paramsSerializer: (params: Record<string, QueryParam | QueryParam[] | undefined>) => string;
  /**
   * Optionally transform headers based on things like the current redux state.
   */
  transformHeaders?: (
    rawHeaders: HeadersInit,
    api: Pick<FetchWrapperApiOpts, "getState" | "extra" | "endpoint" | "type" | "forced">,
  ) => Promise<HeadersInit>;
  /**
   * Optionally pause all requests until the promise returned by this method
   * resolves. In theory, you can pause requests based on the headers and
   * current redux state, for example.
   */
  pauseUntilResolved?: (
    headers: HeadersInit,
    api: Pick<FetchWrapperApiOpts, "getState" | "extra" | "endpoint" | "type" | "forced">,
  ) => Promise<void>;
}) {
  const { baseUrl, transformHeaders = (x) => x, pauseUntilResolved, paramsSerializer } = baseOpts;

  return async (...args: FetchWrapperOpts) => {
    const [fetchArg, api] = args;
    const { signal, getState, extra, endpoint, forced = false, type } = api;

    let { url } = typeof fetchArg === "string" ? { url: fetchArg } : fetchArg;

    const {
      method = "GET",
      headers: rawHeaders = {},
      body = undefined,
      params = undefined,
      // Not supported. Note: it's not possible to easily extra types so disabling instead
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      responseHandler = "json" as const,
      // Not supported. Note: it's not possible to easily extra types so disabling instead
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      validateStatus = () => true,
      ...rest
    } = typeof fetchArg === "string" ? { url: fetchArg } : fetchArg;

    const headers = await transformHeaders(stripUndefined(rawHeaders), { getState, extra, endpoint, forced, type });

    const config: RequestInit = {
      method,
      signal,
      body,
      headers,
      ...rest,
    };

    if (params) {
      url += paramsSerializer(params);
    }

    if (pauseUntilResolved) await pauseUntilResolved(config.headers ?? {}, { getState, extra, endpoint, forced, type });

    try {
      const { data, ...meta } = await apiRequest(method as ApiRequestMethod, `${baseUrl}${url}`, body, {
        fetchOptions: config,
      });

      return {
        data,
        meta,
      };
    } catch (error) {
      if (!isApiError(error)) {
        console.warn("The following is not a recognized error returned by an endpoint", error);

        return {
          error: {
            errors: [JSON.stringify(error, null, " ")],
          },
        };
      }
      return {
        error,
      };
    }
  };
}
