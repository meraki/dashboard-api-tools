import { apiRequest, isApiError, paginatedApiRequest } from "../src";

describe("ApiUtils", () => {
  describe("apiRequest", () => {
    afterEach(() => {
      (global.fetch as jest.Mock).mockClear();
    });

    describe("success", () => {
      type ObjectResponseData = {
        id: string;
        count: number;
      };
      type ArrayResponseData = Array<ObjectResponseData>;

      const responseObject = { id: "1234", count: 23 };

      describe("parses metadata", () => {
        beforeAll(() => {
          global.fetch = jest.fn(() =>
            Promise.resolve({
              json: () => Promise.resolve(responseObject),
              status: 200,
              ok: true,
            }),
          ) as jest.Mock;
        });

        it("is ok", async () => {
          const apiResponse = await apiRequest("GET", "www.fakeurl.com");

          expect(apiResponse.ok).toBe(true);
        });

        describe("when response object is an object", () => {
          it("returns data", async () => {
            const apiResponse = await apiRequest("GET", "www.fakeurl.com", { requestParameter: "requestValue" });

            expect(apiResponse.data).toEqual(responseObject);
          });

          it("can get individual fields from returned data", async () => {
            const apiResponse = await apiRequest<ObjectResponseData>("GET", "www.fakeurl.com", {
              requestParameter: "requestValue",
            });

            expect(apiResponse.data.id).toEqual("1234");
          });
        });

        describe("when response object is an array", () => {
          const secondObjectInResponse = { id: "5678", count: 1 };

          beforeAll(() => {
            global.fetch = jest.fn(() =>
              Promise.resolve({
                json: () => Promise.resolve([responseObject, secondObjectInResponse]),
                status: 200,
                ok: true,
              }),
            ) as jest.Mock;
          });

          it("returns data", async () => {
            const apiResponse = await apiRequest("GET", "www.fakeurl.com", { requestParameter: "requestValue" });

            expect(apiResponse.data).toEqual([responseObject, secondObjectInResponse]);
          });

          it("can get individual objects from returned data", async () => {
            const apiResponse = await apiRequest<ArrayResponseData>("GET", "www.fakeurl.com", {
              requestParameter: "requestValue",
            });

            expect(apiResponse.data[0]).toEqual(responseObject);
            expect(apiResponse.data[1]).toEqual(secondObjectInResponse);
          });
        });

        it("returns status code", async () => {
          const apiResponse = await apiRequest("GET", "www.fakeurl.com", { requestParameter: "requestValue" });

          expect(apiResponse.statusCode).toEqual(200);
        });
      });

      describe("when response is successful but json has a syntax error", () => {
        beforeAll(() => {
          global.fetch = jest.fn(() =>
            Promise.resolve({
              json: () => Promise.reject("SyntaxError: Unexpected end of JSON input"),
              status: 200,
              ok: true,
            }),
          ) as jest.Mock;
        });

        it("returns empty object for data", async () => {
          const apiResponse = await apiRequest("GET", "www.fakeurl.com");

          expect(apiResponse.data).toEqual({});
        });
      });

      describe("when response is successful but has no body", () => {
        beforeAll(() => {
          global.fetch = jest.fn(() =>
            Promise.resolve({
              status: 200,
              ok: true,
            }),
          ) as jest.Mock;
        });

        it("returns empty object for data", async () => {
          const apiResponse = await apiRequest("GET", "www.fakeurl.com");

          expect(apiResponse.data).toEqual({});
        });
      });

      describe("headers", () => {
        describe("Retry-After header", () => {
          describe("when header is a number", () => {
            beforeAll(() => {
              global.fetch = jest.fn(() =>
                Promise.resolve({
                  json: () => Promise.resolve(responseObject),
                  ok: true,
                  headers: {
                    get: (header: string): number | undefined => (header === "Retry-After" ? 100 : undefined),
                  },
                }),
              ) as jest.Mock;
            });

            it("returns parsed retry header", async () => {
              const apiResponse = await apiRequest("GET", "www.fakeurl.com");

              expect(apiResponse.retryAfter).toEqual(100);
            });
          });

          describe("when header is a stringified number", () => {
            beforeAll(() => {
              global.fetch = jest.fn(() =>
                Promise.resolve({
                  json: () => Promise.resolve(responseObject),
                  ok: true,
                  headers: {
                    get: (header: string): string | undefined => (header === "Retry-After" ? "100" : undefined),
                  },
                }),
              ) as jest.Mock;
            });

            it("returns parsed retry header", async () => {
              const apiResponse = await apiRequest("GET", "www.fakeurl.com");

              expect(apiResponse.retryAfter).toEqual(100);
            });
          });

          describe("when header is null", () => {
            beforeAll(() => {
              global.fetch = jest.fn(() =>
                Promise.resolve({
                  json: () => Promise.resolve(responseObject),
                  ok: true,
                  headers: { get: () => null },
                }),
              ) as jest.Mock;
            });

            it("returns parsed retry header", async () => {
              const apiResponse = await apiRequest("GET", "www.fakeurl.com");

              expect(apiResponse.retryAfter).toEqual(null);
            });
          });

          describe("when header is undefined", () => {
            beforeAll(() => {
              global.fetch = jest.fn(() =>
                Promise.resolve({
                  json: () => Promise.resolve(responseObject),
                  ok: true,
                  headers: { get: () => undefined },
                }),
              ) as jest.Mock;
            });

            it("returns parsed retry header", async () => {
              const apiResponse = await apiRequest("GET", "www.fakeurl.com");

              expect(apiResponse.retryAfter).toEqual(null);
            });
          });

          describe("when header is NaN string", () => {
            beforeAll(() => {
              global.fetch = jest.fn(() =>
                Promise.resolve({
                  json: () => Promise.resolve(responseObject),
                  ok: true,
                  headers: {
                    get: (header: string): string | undefined =>
                      header === "Retry-After" ? "this is not a number" : undefined,
                  },
                }),
              ) as jest.Mock;
            });

            it("returns parsed retry header", async () => {
              const apiResponse = await apiRequest("GET", "www.fakeurl.com");

              expect(apiResponse.retryAfter).toEqual(null);
            });
          });
        });

        describe("Link header (pagination)", () => {
          describe("when header is null", () => {
            beforeAll(() => {
              global.fetch = jest.fn(() =>
                Promise.resolve({
                  json: () => Promise.resolve(responseObject),
                  ok: true,
                  headers: { get: () => null },
                }),
              ) as jest.Mock;
            });

            it("returns parsed pagination headers", async () => {
              const apiResponse = await apiRequest("GET", "www.fakeurl.com");

              expect(apiResponse.firstPageUrl).toBeNull();
              expect(apiResponse.lastPageUrl).toBeNull();
              expect(apiResponse.nextPageUrl).toBeNull();
              expect(apiResponse.prevPageUrl).toBeNull();
            });
          });

          describe("when header is undefined", () => {
            beforeAll(() => {
              global.fetch = jest.fn(() =>
                Promise.resolve({
                  json: () => Promise.resolve(responseObject),
                  ok: true,
                  headers: { get: () => undefined },
                }),
              ) as jest.Mock;
            });

            it("returns parsed pagination headers", async () => {
              const apiResponse = await apiRequest("GET", "www.fakeurl.com");

              expect(apiResponse.firstPageUrl).toBeNull();
              expect(apiResponse.lastPageUrl).toBeNull();
              expect(apiResponse.nextPageUrl).toBeNull();
              expect(apiResponse.prevPageUrl).toBeNull();
            });
          });

          describe("when header is set", () => {
            const linkHeader =
              "<firstPageUrl>; rel=first, <lastPageUrl>; rel=last, <nextPageUrl>; rel=next, <prevPageUrl>; rel=prev";

            beforeAll(() => {
              global.fetch = jest.fn(() =>
                Promise.resolve({
                  json: () => Promise.resolve(responseObject),
                  ok: true,
                  headers: { get: () => linkHeader },
                }),
              ) as jest.Mock;
            });

            it("returns parsed pagination headers", async () => {
              const apiResponse = await apiRequest("GET", "www.fakeurl.com");

              expect(apiResponse.linkHeader).toEqual(linkHeader);
              expect(apiResponse.firstPageUrl).toEqual("firstPageUrl");
              expect(apiResponse.lastPageUrl).toEqual("lastPageUrl");
              expect(apiResponse.nextPageUrl).toEqual("nextPageUrl");
              expect(apiResponse.prevPageUrl).toEqual("prevPageUrl");
            });
          });
        });
      });
      describe("Auth Headers", () => {
        describe("when csrfToken is passed in", () => {
          const nonGetOptions = {
            fetchOptions: {},
            auth: {
              csrfToken: "banana",
            },
          };

          it("sets the headers with X-CSRF-TOKEN", async () => {
            await apiRequest("POST", "www.fakeurl.com", {}, nonGetOptions);
            const spiedFetch = jest.spyOn(global, "fetch");
            expect(spiedFetch.mock.calls[0][1]).toEqual({
              body: "{}",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": "banana",
              },
              method: "POST",
              redirect: "follow",
              referrerPolicy: "strict-origin-when-cross-origin",
            });
          });
        });

        describe("when apiKey is passed in", () => {
          const nonGetOptions = {
            fetchOptions: {},
            auth: {
              apiKey: "banana",
            },
          };

          it("sets the headers with X-Cisco-Meraki-API-Key", async () => {
            await apiRequest("POST", "www.fakeurl.com", {}, nonGetOptions);
            const spiedFetch = jest.spyOn(global, "fetch");
            expect(spiedFetch.mock.calls[0][1]).toEqual({
              body: "{}",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-Cisco-Meraki-API-Key": "banana",
              },
              method: "POST",
              redirect: "follow",
              referrerPolicy: "strict-origin-when-cross-origin",
            });
          });
        });
      });
    });

    /* eslint-disable @typescript-eslint/no-explicit-any */
    describe("failure", () => {
      describe("response doesn't have text", () => {
        beforeAll(() => {
          global.fetch = jest.fn(() =>
            Promise.resolve({
              status: 500,
              statusText: "Internal server error",
              ok: false,
            }),
          ) as jest.Mock;
        });

        it("returns error details", async () => {
          try {
            await apiRequest("GET", "www.bad-url.com");
          } catch (badResponse: any) {
            expect(badResponse.ok).toEqual(false);
            expect(badResponse.errors).toEqual(["Could not parse errors from response"]);
            expect(badResponse.statusCode).toEqual(500);
            expect(badResponse.statusText).toEqual("Internal server error");
          }
        });
      });

      describe("response is json", () => {
        beforeAll(() => {
          global.fetch = jest.fn(() =>
            Promise.resolve({
              status: 500,
              statusText: "Internal server error",
              json: () => ({ errors: ["custom error"] }),
              ok: false,
            }),
          ) as jest.Mock;
        });

        it("returns error details", async () => {
          try {
            await apiRequest("GET", "www.bad-url.com");
          } catch (badResponse: any) {
            expect(badResponse.ok).toEqual(false);
            expect(badResponse.errors).toEqual(["custom error"]);
            expect(badResponse.statusCode).toEqual(500);
            expect(badResponse.statusText).toEqual("Internal server error");
          }
        });
      });

      describe("response is not json", () => {
        beforeAll(() => {
          global.fetch = jest.fn(() => Promise.resolve({ json: () => "custom error" })) as jest.Mock;
        });

        it("returns empty list for errors", async () => {
          try {
            await apiRequest("GET", "www.bad-url.com");
          } catch (badResponse: any) {
            expect(badResponse.errors).toEqual([]);
          }
        });
      });
    });

    describe("rate limit", () => {
      const responseObject = { id: "1234", count: 23 };
      const retrySec = 1;
      const successfulResponse = {
        json: () => Promise.resolve(responseObject),
        status: 200,
        ok: true,
      };
      const retryHeader = {
        get: (header: string): number | undefined => (header === "Retry-After" ? retrySec : undefined),
      };
      const rateLimitedResponse = (useHeader = true) => {
        return {
          json: () => ({ errors: ["Rate limit error"] }),
          status: 429,
          ok: false,
          headers: useHeader ? retryHeader : undefined,
        };
      };

      beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        global.setTimeout = jest.fn((f) => f());
      });

      afterEach(() => {
        jest.clearAllMocks();
      });

      it("fails after 5 retries when 429 is returned each time", async () => {
        global.fetch = jest.fn().mockResolvedValue(rateLimitedResponse()) as jest.Mock;
        try {
          await apiRequest("GET", "www.rate_limit.com");
        } catch (badResponse: any) {
          expect(fetch).toHaveBeenCalledTimes(6);
          expect(badResponse.errors).toEqual(["Rate limit error"]);
          expect(badResponse.statusCode).toEqual(429);
        }
      });

      it("resolves 200 response after 2 retries", async () => {
        global.fetch = jest
          .fn()
          .mockResolvedValueOnce(rateLimitedResponse())
          .mockResolvedValueOnce(rateLimitedResponse())
          .mockResolvedValueOnce(successfulResponse) as jest.Mock;
        const apiResponse = await apiRequest("GET", "www.rate_limit.com");
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(apiResponse.ok).toBe(true);
        expect(apiResponse.data).toEqual(responseObject);
      });

      it("follows Retry-After header if it presents", async () => {
        Math.random = jest.fn(() => 0);
        global.fetch = jest
          .fn()
          .mockResolvedValueOnce(rateLimitedResponse())
          .mockResolvedValueOnce(successfulResponse) as jest.Mock;
        await apiRequest("GET", "www.rate_limit.com");

        expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), retrySec * 1000);
      });

      it("does exponential backoff if the 'Retry-After' header is not present", async () => {
        Math.random = jest.fn(() => 0);
        global.fetch = jest
          .fn()
          .mockResolvedValueOnce(rateLimitedResponse(false))
          .mockResolvedValueOnce(rateLimitedResponse(false))
          .mockResolvedValueOnce(rateLimitedResponse(false))
          .mockResolvedValueOnce(successfulResponse) as jest.Mock;
        await apiRequest("GET", "www.rate_limit.com");

        expect(setTimeout).toHaveBeenNthCalledWith(1, expect.any(Function), 1.5 * 1000);
        expect(setTimeout).toHaveBeenNthCalledWith(2, expect.any(Function), 1.5 ** 2 * 1000);
        expect(setTimeout).toHaveBeenNthCalledWith(3, expect.any(Function), 1.5 ** 3 * 1000);
      });
    });
  });

  describe("isApiError", () => {
    describe("when input is ok", () => {
      it("returns false", async () => {
        const notApiError = {
          ok: true,
          errors: ["one error", "two errors", "red errors", "blue errors"],
          statusCode: 500,
          statusText: "bad request",
        };

        expect(isApiError(notApiError)).toBe(false);
      });
    });

    describe("when input does not have valid errors", () => {
      it("returns false", async () => {
        const notApiError = {
          ok: true,
          errors: "[1, 2, 3]",
          statusCode: 500,
          statusText: "bad request",
        };

        expect(isApiError(notApiError)).toBe(false);
      });
    });

    describe("when input does not have valid statusCode", () => {
      it("returns false", async () => {
        const notApiError = {
          ok: true,
          errors: ["one error", "two errors", "red errors", "blue errors"],
          statusCode: "500",
          statusText: "bad request",
        };

        expect(isApiError(notApiError)).toBe(false);
      });
    });

    describe("when input does not have valid statusText", () => {
      it("returns false", async () => {
        const notApiError = {
          ok: true,
          errors: ["one error", "two errors", "red errors", "blue errors"],
          statusCode: 500,
          statusText: 500,
        };

        expect(isApiError(notApiError)).toBe(false);
      });
    });

    describe("when input is good", () => {
      it("returns true", async () => {
        const notApiError = {
          ok: false,
          errors: ["one error", "two errors", "red errors", "blue errors"],
          statusCode: 500,
          statusText: "bad request",
        };

        expect(isApiError(notApiError)).toBe(true);
      });
    });
  });

  describe("integration between apiRequest and isApiError", () => {
    describe("with errors", () => {
      beforeAll(() => {
        global.fetch = jest.fn(() =>
          Promise.resolve({
            status: 500,
            statusText: "bad request",
            json: () => ({ errors: ["this is a good error format"] }),
            ok: false,
          }),
        ) as jest.Mock;
      });

      it("returns true", async () => {
        try {
          await apiRequest("GET", "www.bad-url.com");
        } catch (badResponse) {
          expect(isApiError(badResponse)).toBe(true);
        }
      });
    });

    describe("with no errors", () => {
      beforeAll(() => {
        global.fetch = jest.fn(() =>
          Promise.resolve({
            status: 200,
            statusText: "good request",
            json: () => ({ somethingThatIsNotErrors: ["this is NOT an error!"] }),
            ok: true,
          }),
        ) as jest.Mock;
      });

      it("returns false", async () => {
        const response = await apiRequest("GET", "www.good-url.com");

        expect(isApiError(response)).toBe(false);
      });
    });
  });

  describe("paginatedApiRequest", () => {
    describe("successful response", () => {
      let count: number;
      let responseObject: Record<string, unknown>;
      const expectedCalls = 5;

      beforeEach(() => {
        count = 0;
        responseObject = { id: "1234" };

        global.fetch = jest.fn(() =>
          Promise.resolve({
            json: () => {
              count++;
              return Promise.resolve(responseObject);
            },
            status: 200,
            ok: true,
            headers: {
              get: (): string | undefined =>
                count < expectedCalls
                  ? `</api/v0/foos?startingAfter=0>; rel=first, </api/v0/foos?startingAfter=${count}>; rel=next`
                  : undefined,
            },
          }),
        ) as jest.Mock;
      });

      it("calls provided dataHandler function with response data", async () => {
        const dataHandler = jest.fn();

        await paginatedApiRequest(dataHandler, jest.fn(), { method: "GET", url: "www.fakeurl.com" });

        expect(dataHandler).toHaveBeenCalledWith(responseObject);
      });

      it("calls provided dataHandler function for each successful request", async () => {
        const dataHandler = jest.fn();

        await paginatedApiRequest(dataHandler, jest.fn(), { method: "GET", url: "www.fakeurl.com" });

        expect(dataHandler).toHaveBeenCalledTimes(expectedCalls);
      });

      it("calls subsequent paginated requests with next page url", async () => {
        const dataHandler = jest.fn();

        await paginatedApiRequest(dataHandler, jest.fn(), { method: "GET", url: "/api/v0/foos?startingAfter=0" });

        expect(fetch).toHaveBeenCalledTimes(5);
        expect((fetch as jest.Mock).mock.calls[0][0]).toEqual("/api/v0/foos?startingAfter=0");
        expect((fetch as jest.Mock).mock.calls[1][0]).toEqual("/api/v0/foos?startingAfter=1");
        expect((fetch as jest.Mock).mock.calls[2][0]).toEqual("/api/v0/foos?startingAfter=2");
        expect((fetch as jest.Mock).mock.calls[3][0]).toEqual("/api/v0/foos?startingAfter=3");
        expect((fetch as jest.Mock).mock.calls[4][0]).toEqual("/api/v0/foos?startingAfter=4");
      });

      it("stops making requests when provided maxRequests threshold is reached", async () => {
        const dataHandler = jest.fn();
        const maxRequests = 3;

        await paginatedApiRequest(dataHandler, jest.fn(), { method: "GET", url: "www.fakeurl.com" }, maxRequests);

        expect(fetch).toHaveBeenCalledTimes(maxRequests);
        expect(dataHandler).toHaveBeenCalledTimes(maxRequests);
      });
    });
  });

  describe("unsuccessful response", () => {
    beforeEach(() => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          status: 500,
          statusText: "Internal server error",
          json: () => ({ errors: ["first error", "second error"] }),
          ok: false,
        }),
      ) as jest.Mock;
    });

    it("calls provided errorHandler function for each unsuccessful request", async () => {
      const errorHandler = jest.fn();

      await paginatedApiRequest(jest.fn(), errorHandler, { method: "GET", url: "www.fakeurl.com" });

      expect(errorHandler).toHaveBeenCalledWith(["first error", "second error"]);
    });
  });
});
