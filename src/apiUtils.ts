const httpMethods = ["get", "post", "put", "delete", "options", "GET", "POST", "PUT", "DELETE", "OPTIONS"] as const;
export type HTTPMethod = typeof httpMethods[number];
export type ApiError = {
  errors: string[];
  ok: false;
  statusCode: number;
  statusText: string;
};
export type Options = {
  fetchOptions?: RequestInit | undefined;
  auth?: {
    apiKey?: string;
    csrfToken?: string;
  };
};
type AuthHeaders = {
  "X-CSRF-TOKEN"?: string;
  "X-Cisco-Meraki-API-Key"?: string;
};

export type ApiResponse<ResponseData> = ApiMetadata & {
  data: ResponseData;
};
type ApiMetadata = {
  firstPageUrl: string | null;
  lastPageUrl: string | null;
  nextPageUrl: string | null;
  prevPageUrl: string | null;
  linkHeader: string | null;
  retryAfter: number | null;
  errors: null;
  ok: true;
  statusCode: number;
  statusText: string;
};
export type ApiRequestParams = {
  method: HTTPMethod;
  url: string;
  data?: Record<string, unknown> | undefined;
  options?: Options;
};
type PaginationHeaderLink = { url: string; rel: string };

const extractUrlFromLinkHeader = (linkHeader: string, targetRel: string): string | null => {
  if (!linkHeader) return null;

  const links = linkHeader.split(", ").map((link) => {
    const [url, r] = (link.match(/^<([^>]+)>; rel=(.+)$/) || []).slice(1);
    if (url && r) return { url, rel: r };
  });

  const link = links.find((link: PaginationHeaderLink | undefined) => link?.rel === targetRel);

  return link ? link.url : null;
};

const extractCustomHeaders = (response: Response): ApiMetadata => {
  const linkHeader = response.headers?.get("Link");
  const retryAfterHeader = response.headers?.get("Retry-After");
  const parsedRetryHeader = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;

  return {
    statusCode: response.status,
    statusText: response.statusText,
    errors: null,
    ok: true,
    retryAfter: parsedRetryHeader || null,
    firstPageUrl: linkHeader ? extractUrlFromLinkHeader(linkHeader, "first") : null,
    prevPageUrl: linkHeader ? extractUrlFromLinkHeader(linkHeader, "prev") : null,
    nextPageUrl: linkHeader ? extractUrlFromLinkHeader(linkHeader, "next") : null,
    lastPageUrl: linkHeader ? extractUrlFromLinkHeader(linkHeader, "last") : null,
    linkHeader,
  };
};

const successResponse = async <ResponseData>(response: Response): Promise<ApiResponse<ResponseData>> => {
  let responseData;

  try {
    responseData = await response.json();
  } catch {
    responseData = {};
  }

  const responseMetadata = extractCustomHeaders(response);

  return Promise.resolve({ data: responseData, ...responseMetadata });
};

const failureResponse = async <ResponseData>(response: Response): Promise<ApiResponse<ResponseData>> => {
  let errors;

  try {
    const errorData = await response.json();

    errors = errorData?.errors || [];
  } catch {
    errors = ["Could not parse errors from response"];
  }

  return Promise.reject({
    errors,
    statusCode: response.status,
    statusText: response.statusText,
    ok: response.ok,
  });
};

const apiRequest = async <ResponseData>(
  method: HTTPMethod,
  url: string,
  data?: Record<string, unknown> | undefined,
  options?: Options,
): Promise<ApiResponse<ResponseData>> => {
  const authHeaders: AuthHeaders = {};

  if (options?.auth?.csrfToken) {
    authHeaders["X-CSRF-TOKEN"] = options.auth.csrfToken;
  }

  if (options?.auth?.apiKey) {
    authHeaders["X-Cisco-Meraki-API-Key"] = options.auth.apiKey;
  }

  const fetchOptions: RequestInit = {
    method: method,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders },
    redirect: "follow",
    referrerPolicy: "strict-origin-when-cross-origin",
    ...options?.fetchOptions,
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const totalRetries = 5;
  let attempt = 0;

  if (typeof data !== "undefined") {
    fetchOptions.body = JSON.stringify(data);
  }

  let response = await fetch(url, fetchOptions);

  while (response.status === 429 && attempt < totalRetries) {
    const retrySec: number = extractCustomHeaders(response).retryAfter || 1.5 ** (attempt + 1);
    await sleep((retrySec + Math.random()) * 1000);
    response = await fetch(url, fetchOptions);
    attempt += 1;
  }

  return response.ok ? successResponse<ResponseData>(response) : failureResponse<ResponseData>(response);
};

const isApiError = (response: unknown): response is ApiError => {
  const errorResponse = response as ApiError;
  const hasApiErrors =
    Array.isArray(errorResponse?.errors) && errorResponse?.errors.every((error) => typeof error === "string");

  return (
    hasApiErrors &&
    errorResponse?.ok === false &&
    typeof errorResponse?.statusCode === "number" &&
    typeof errorResponse?.statusText === "string"
  );
};

const makePaginatedRequest = async <ResponseData>(
  dataHandler: (data: ResponseData) => void,
  errorHandler: (errors: string[]) => void,
  apiRequestParams: ApiRequestParams,
  maxRequests: number,
  requestCount: number,
) => {
  if (requestCount >= maxRequests) {
    return;
  }

  try {
    const { method, url } = apiRequestParams;
    const apiResp = await apiRequest<ResponseData>(method, url);

    const { data: responseData, nextPageUrl } = apiResp;
    dataHandler(responseData);

    if (nextPageUrl) {
      await makePaginatedRequest<ResponseData>(
        dataHandler,
        errorHandler,
        { ...apiRequestParams, url: nextPageUrl },
        maxRequests,
        ++requestCount,
      );
    }
  } catch (badResponse) {
    if (isApiError(badResponse)) {
      errorHandler(badResponse.errors);
    } else {
      throw new Error("Paginated API request failed with unknown error.");
    }
  }
};

const paginatedApiRequest = async <ResponseData>(
  dataHandler: (data: ResponseData) => void,
  errorHandler: (errors: string[]) => void,
  apiRequestParams: ApiRequestParams,
  maxRequests = 9999,
) => {
  await makePaginatedRequest(dataHandler, errorHandler, apiRequestParams, maxRequests, 0);
};

export { apiRequest, isApiError, paginatedApiRequest };
