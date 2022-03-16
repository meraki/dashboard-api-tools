const httpMethods = ["get", "post", "put", "delete", "options", "GET", "POST", "PUT", "DELETE", "OPTIONS"] as const;
export type HTTPMethod = typeof httpMethods[number];
type ApiError = {
  errors: string[]
  ok: false;
  statusCode: number;
  statusText: string;
};
export type Options = {
  fetchOptions?: RequestInit | undefined;
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
}
type PaginationHeaderLink = { url: string; rel: string; }

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
  const responseJson = response.json();
  const responseMetadata = extractCustomHeaders(response);

  return Promise.all([responseJson, responseMetadata]).then(([data, metadata]) => ({ data, ...metadata }));
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
  const fetchOptions: RequestInit = {
    method: method,
    headers: { "Content-Type": "application/json" },
    redirect: "follow",
    referrerPolicy: "strict-origin-when-cross-origin",
    ...options?.fetchOptions,
  };

  if (typeof data !== "undefined") {
    fetchOptions.body = JSON.stringify(data);
  }

  const response = await fetch(url, fetchOptions);

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
  if(requestCount >= maxRequests) {
    return;
  }

  try {
    const { method, url } = apiRequestParams;
    const apiResp = await apiRequest<ResponseData>(method, url);

    const { data: responseData, nextPageUrl } = apiResp;

    dataHandler(responseData);

    if (nextPageUrl) {
      await makePaginatedRequest<ResponseData>(dataHandler, errorHandler, apiRequestParams, maxRequests, ++requestCount);
    }
  } catch (badResponse) {
    if(isApiError(badResponse)) {
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