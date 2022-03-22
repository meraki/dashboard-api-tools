import { apiRequest, ApiResponse, ApiError, Options, isApiError } from "./apiUtils";

type Errors = string[];

type ActionBatchStatus = {
  completed: boolean;
  failed: boolean;
  errors: Errors;
  createdResources?: Record<string, unknown>;
};

type Action = {
  resource: string | null;
  operation: "create" | "update" | "destroy";
  body: Record<string, unknown>;
};

type ActionBatchResponse = {
  id: string;
  organizationId: string;
  confirmed: boolean;
  synchronous: boolean;
  status: ActionBatchStatus;
  actions: Action[];
};

type ActionBatchOptions = {
  maxPollingTime?: number;
  interval?: number;
  synchronous?: boolean;
};

const checkBatchStatus = async (orgId: string, batchId: string): Promise<ApiResponse<ActionBatchResponse>> => {
  const url = `/api/v1/organizations/${orgId}/actionBatches/${batchId}`;
  const apiResp = await apiRequest<ActionBatchResponse>("GET", url);
  return apiResp;
};

const sleep = (ms: number): Promise<(res: TimerHandler) => number> => {
  return new Promise((res) => setTimeout(res, ms));
};

const makeFailResponseObj = (apiResponse: ApiResponse<ActionBatchResponse>): ApiError => {
  //action batch itself failed;
  //apiResp will have errors;
  //formatting it here for consistent error returns
  const status = apiResponse.data.status;
  const error = {
    errors: status.errors,
    ok: status.completed,
    statusCode: apiResponse.statusCode,
    statusText: apiResponse.statusText,
  } as ApiError;

  return error;
};

const handleActionBatchStatus = (
  apiResponse: ApiResponse<ActionBatchResponse>,
): ApiResponse<ActionBatchResponse> | ApiError | undefined => {
  const batchStatus = apiResponse.data.status;

  if (batchStatus.completed) {
    return apiResponse;
  } else if (batchStatus.failed) {
    const error = makeFailResponseObj(apiResponse);
    return error;
  } else {
    return undefined;
  }
};

const pollActionBatch = async (
  orgId: string,
  batchId: string,
  opts?: ActionBatchOptions,
): Promise<ApiResponse<ActionBatchResponse>> => {
  const interval = opts?.interval || 500;
  const endTime = Date.now() + (opts?.maxPollingTime || 12000);
  const maxPollingErrorMsg = "Your updates have been submitted and are still pending. Try reloading the page.";

  while (Date.now() <= endTime) {
    try {
      const apiResp = await checkBatchStatus(orgId, batchId);
      const respOrError = handleActionBatchStatus(apiResp);

      if (isApiError(respOrError)) {
        return Promise.reject(respOrError);
      } else if (respOrError !== undefined) {
        return respOrError;
      } else if (Date.now() <= endTime) {
        await sleep(interval);
      }
    } catch (failedResponse) {
      return Promise.reject(failedResponse);
    }
  }
  // if nothing has been returned by now we have hit the maxPollingTime
  const error = {
    errors: [maxPollingErrorMsg],
    ok: false,
    statusCode: 200,
    statusText: "max timeout",
  } as ApiError;

  return Promise.reject(error);
};

const batchedApiRequest = async (
  orgId: string,
  actions: Action[],
  authOptions: Options,
  opts?: ActionBatchOptions,
): Promise<ApiResponse<ActionBatchResponse>> => {
  const url = `/api/v1/organizations/${orgId}/actionBatches`;
  const data = {
    confirmed: true,
    synchronous: !!opts?.synchronous, // by default we want async
    actions,
  };

  try {
    const apiResp = await apiRequest<ActionBatchResponse>("POST", url, data, authOptions);
    const respOrError = handleActionBatchStatus(apiResp);
    const { id } = apiResp.data;

    if (isApiError(respOrError)) {
      return Promise.reject(respOrError);
    } else if (respOrError !== undefined) {
      return respOrError;
    } else {
      return await pollActionBatch(orgId, id, opts);
    }
  } catch (failedResponse) {
    return Promise.reject(failedResponse);
  }
};

export { batchedApiRequest };
