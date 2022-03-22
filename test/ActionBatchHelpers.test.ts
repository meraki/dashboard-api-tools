import { batchedApiRequest } from "../src/actionBatchHelpers";
import { apiRequest } from "../src/apiUtils";

jest.mock("../src/apiUtils");
const mockedApiRequest = jest.mocked(apiRequest) as jest.Mock;

describe("ActionBatchHelers", () => {
  afterEach(() => {
    mockedApiRequest.mockClear();
  });

  describe("batchedApiRequest", () => {
    const VALID_ACTION = {
      resource: "/devices/QXXX-XXXX-XXXX/switchPorts/3",
      operation: "update",
      body: { enabled: true },
    } as const;
    const orgId = "2";
    const actions = [VALID_ACTION];
    const authOptions = {
      auth: {
        csrfToken: "banana",
      },
    };

    it("resolves the status field from a successful action batch response", async () => {
      mockedApiRequest.mockResolvedValueOnce({
        data: {
          id: "1234",
          status: {
            completed: true,
            failed: false,
            errors: [],
          },
        },
      });
      const resp = await batchedApiRequest(orgId, actions, authOptions);
      expect(resp.data.status.completed).toEqual(true);
      expect(resp.data.status.failed).toEqual(false);
      expect(resp.data.status.errors).toEqual([]);
    });

    it("rejects a failed action batch request with error message", async () => {
      const errorMsgs = ["action batch request failure"];
      mockedApiRequest.mockResolvedValueOnce({
        data: {
          id: "1234",
          status: {
            completed: false,
            failed: true,
            errors: errorMsgs,
          },
        },
      });

      try {
        await batchedApiRequest(orgId, actions, authOptions);
      } catch (err: any) {
        expect(err.errors).not.toBeNull();
        expect(err.errors).toEqual(errorMsgs);
      }
    });

    it("rejects a failed api request with the error message", async () => {
      const errorMsgs = ["Internal server error"];
      mockedApiRequest.mockRejectedValueOnce({
        statusCode: 500,
        errors: errorMsgs,
      });

      try {
        await batchedApiRequest(orgId, actions, authOptions);
      } catch (err: any) {
        expect(err.errors).not.toBeNull();
        expect(err.errors).toEqual(errorMsgs);
      }
    });

    it("returns an error when the max polling time limit is reached", async () => {
      mockedApiRequest.mockResolvedValue({
        data: {
          id: "1234",
          status: {
            completed: false,
            failed: false,
            errors: [],
          },
        },
      });

      try {
        await batchedApiRequest(orgId, actions, authOptions, { maxPollingTime: 1 });
      } catch (err: any) {
        expect(err.errors).not.toBeNull();
        expect(err.errors).toEqual(["Your updates have been submitted and are still pending. Try reloading the page."]);
      }
    });
    it("polls the status when the initial status is pending", async () => {
      mockedApiRequest.mockResolvedValue({
        data: {
          id: "1234",
          status: {
            completed: false,
            failed: false,
            errors: [],
          },
        },
      });
      try {
        await batchedApiRequest(orgId, actions, authOptions, { maxPollingTime: 5 });
      } catch (err: unknown) {
        expect(mockedApiRequest.mock.calls.length).toBeGreaterThan(1);
        expect(mockedApiRequest.mock.calls).toContainEqual(["GET", "/api/v1/organizations/2/actionBatches/1234"]);
      }
    });
  });
});
