import { apiRequest, isApiError } from "../src";

describe("ApiUtils", () => {

  describe("apiRequest", () => {

    afterEach(() => {
      (global.fetch as jest.Mock).mockClear();
    });

    describe("success", () => {
      const responseData = { clients: [{ name: "name" }] };

      describe("parses metadata", () => {
        beforeAll(() => {
          global.fetch = jest.fn(() => Promise.resolve(
            {
              json: () => Promise.resolve(responseData),
              status: 200,
              ok: true,
            }),
          ) as jest.Mock;
        });

        it("is ok", async () => {
          const apiResponse = await apiRequest("GET", "www.fakeurl.com");

          expect(apiResponse.ok).toBe(true);
        });

        it("returns data", async () => {
          const apiResponse = await apiRequest("GET", "www.fakeurl.com", { requestParameter: "requestValue" });

          expect(apiResponse.data).toEqual(responseData);
        });

        it("returns status code", async () => {
          const apiResponse = await apiRequest("GET", "www.fakeurl.com", { requestParameter: "requestValue" });

          expect(apiResponse.statusCode).toEqual(200);
        });
      });

      describe("headers", () => {
        describe("Retry-After hedaer", () => {
          describe("when header is a number", () => {
            beforeAll(() => {
              global.fetch = jest.fn(() => Promise.resolve(
                {
                  json: () => Promise.resolve(responseData),
                  ok: true,
                  headers: { get: (header: string): number | undefined => (header === "Retry-After" ? 100 : undefined) },
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
              global.fetch = jest.fn(() => Promise.resolve(
                {
                  json: () => Promise.resolve(responseData),
                  ok: true,
                  headers: { get: (header: string): string | undefined => (header === "Retry-After" ? "100" : undefined) },
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
              global.fetch = jest.fn(() => Promise.resolve(
                {
                  json: () => Promise.resolve(responseData),
                  ok: true,
                  headers: { get: () => (null) },
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
              global.fetch = jest.fn(() => Promise.resolve(
                {
                  json: () => Promise.resolve(responseData),
                  ok: true,
                  headers: { get: () => (undefined) },
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
              global.fetch = jest.fn(() => Promise.resolve(
                {
                  json: () => Promise.resolve(responseData),
                  ok: true,
                  headers: { get: (header: string): string | undefined => (header === "Retry-After" ? "this is not a number" : undefined) },
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
              global.fetch = jest.fn(() => Promise.resolve(
                {
                  json: () => Promise.resolve(responseData),
                  ok: true,
                  headers: { get: () => (null) },
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
              global.fetch = jest.fn(() => Promise.resolve(
                {
                  json: () => Promise.resolve(responseData),
                  ok: true,
                  headers: { get: () => (undefined) },
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
              global.fetch = jest.fn(() => Promise.resolve(
                {
                  json: () => Promise.resolve(responseData),
                  ok: true,
                  headers: { get: () => (linkHeader) },
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
    });

    /* eslint-disable @typescript-eslint/no-explicit-any */
    describe("failure", () => {
      describe("response doesn't have text", () => {
        beforeAll(() => {
          global.fetch = jest.fn(() => Promise.resolve(
            {
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
          global.fetch = jest.fn(() => Promise.resolve(
            {
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
        global.fetch = jest.fn(() => Promise.resolve(
          {
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
        global.fetch = jest.fn(() => Promise.resolve(
          {
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
});

