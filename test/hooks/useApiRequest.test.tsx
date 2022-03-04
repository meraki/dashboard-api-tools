import { apiRequest, isApiError } from "../../src/index";
import { useApiRequest } from "../../src/hooks/useApiRequest";
import { render, waitFor } from "@testing-library/react";

jest.mock("../../src/index");
const mockedApiRequest = jest.mocked(apiRequest) as jest.Mock;
const mockedIsApiError = jest.mocked(isApiError) as jest.Mock;

type SuccessfulResponse = {
  id: string
}

describe("useApiRequest", () => {

  const ComponentUsingHook = () => {
    const [response, errors, isFetching] = useApiRequest<SuccessfulResponse>({method: "GET", url: "www.fake.url.com" }, []);

    return (
      <div>
        {
          isFetching && <div>Loading</div>
        }
        {
          !isFetching && response && <div>{response.data?.id}</div>
        }
        {
          !isFetching && errors && <div>
            <div>So many errors</div>
            {
              errors.map((error, index) => <div key={index}>{error}</div>)
            }
          </div>
        }
      </div>
    );
  };

  afterEach(() => {
    mockedApiRequest.mockClear();
  });

  describe("request NOT finished", () => {
    it("returns isLoading true", async () => {
      const { queryByText } = render(<ComponentUsingHook />);

      await waitFor(() => expect(queryByText("Loading")).not.toBeNull());
    });
  });

  describe("request finished", () => {
    describe("failure case", () => {
      describe("isApiError() returns true", () => {
        beforeEach(() => {
          mockedIsApiError.mockReturnValueOnce(true);
          mockedApiRequest.mockRejectedValueOnce({ errors: ["first error", "second error"] });
        });
    
        it("returns errors", async () => {
          const { queryByText } = render(<ComponentUsingHook />);
    
          await waitFor(() => expect(queryByText("Loading")).toBeNull());
          expect(queryByText("Loading")).toBeNull();

          expect(queryByText("So many errors")).not.toBeNull();
          expect(queryByText("first error")).not.toBeNull();
          expect(queryByText("second error")).not.toBeNull();
        });
      });

      describe("isApiError() returns false", () => {
        beforeEach(() => {
          mockedIsApiError.mockReturnValueOnce(false);
          mockedApiRequest.mockRejectedValueOnce({ errors: { "message": "something went wrong" } });
        });
    
        it("returns errors", async () => {
          const { queryByText } = render(<ComponentUsingHook />);
    
          await waitFor(() => expect(queryByText("Loading")).toBeNull());
          expect(queryByText("Loading")).toBeNull();

          expect(queryByText("So many errors")).not.toBeNull();
          expect(queryByText("Could not parse errors from response")).not.toBeNull();
        });
      });
    });
  
    describe("success case", () => {
      beforeEach(() => {
        mockedApiRequest.mockResolvedValueOnce({ ok: true, data: { id: "1234" } });
      });
  
      it("returns response", async () => {
        const { queryByText } = render(<ComponentUsingHook />);
  
        await waitFor(() => expect(queryByText("Loading")).toBeNull());
        expect(queryByText("Loading")).toBeNull();

        expect(queryByText("1234")).not.toBeNull();
        expect(queryByText("So many errors")).toBeNull();
      });
    });
  });
});