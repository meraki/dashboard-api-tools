import { apiRequest, ApiResponse, ApiError, Options } from "./apiUtils";

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

const sleep = (ms: number): Promise<(res: TimerHandler) => number> => {
  return new Promise((res) => setTimeout(res, ms));
};

const makeFailResponseObj = (apiResponse: ApiResponse<ActionBatchResponse>): ApiError => {
  //action batch itself failed;
  //apiResponse will have errors;
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
  let apiResp;
  // try to make a post actionBatch request
  try {
    apiResp = await apiRequest<ActionBatchResponse>("POST", url, data, authOptions);
    if (apiResp.data?.status?.completed) {
      return apiResp;
    } else if (apiResp.data?.status?.failed) {
      return Promise.reject(makeFailResponseObj(apiResp));
    }
  } catch (failedResponse) {
    return Promise.reject(failedResponse);
  }

  // now we check the actionBatch status to see if things have changed since it was neither failed nor completed (aka pending)
  const interval = opts?.interval || 500; //ms
  const endTime = Date.now() + (opts?.maxPollingTime || 12000); //ms
  while (Date.now() <= endTime) {
    try {
      const apiCheckResp = await apiRequest<ActionBatchResponse>(
        "GET",
        `/api/v1/organizations/${orgId}/actionBatches/${apiResp.data.id}`,
      );

      if (apiCheckResp.data?.status?.completed) {
        return apiCheckResp;
      } else if (apiCheckResp.data?.status?.failed) {
        return Promise.reject(makeFailResponseObj(apiCheckResp));
      } else {
        await sleep(interval);
      }
    } catch (failedResponse) {
      return Promise.reject(failedResponse);
    }
  }

  const maxPollingErrorMsg = "Your updates have been submitted and are still pending. Try reloading the page.";
  const error = {
    errors: [maxPollingErrorMsg],
    ok: false,
    statusCode: 200,
    statusText: "max timeout",
  } as ApiError;

  return Promise.reject(error);
};

export { batchedApiRequest };
