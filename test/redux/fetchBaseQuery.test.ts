import { fetchBaseQuery } from "../../src";

type FetchArgs = Parameters<ReturnType<typeof fetchBaseQuery>>;
type FetchApiArgs = FetchArgs[1];

describe("fetchBaseQuery", () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ id: "1234", count: 23 }),
        status: 200,
        ok: true,
      }),
    ) as jest.Mock;
  });

  afterEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it("should return the expected data and meta data", async () => {
    const reduxFetch = fetchBaseQuery({
      baseUrl: "/test/",
      paramsSerializer: () => "",
    });

    const result = await reduxFetch("base", {} as FetchApiArgs, {});
    expect(result).toEqual({
      data: { id: "1234", count: 23 },
      meta: {
        errors: null,
        firstPageUrl: null,
        lastPageUrl: null,
        linkHeader: undefined,
        nextPageUrl: null,
        ok: true,
        prevPageUrl: null,
        retryAfter: null,
        statusCode: 200,
        statusText: undefined,
      },
    });
  });

  it("should handle errors", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ errors: ["an error occurred"] }),
        status: 500,
        statusText: "",
        ok: false,
      }),
    ) as jest.Mock;

    const reduxFetch = fetchBaseQuery({
      baseUrl: "/test/",
      paramsSerializer: () => "",
    });

    const result = await reduxFetch("base", {} as FetchApiArgs, {});

    expect(result).toEqual({
      error: {
        errors: ["an error occurred"],
        ok: false,
        statusCode: 500,
        statusText: "",
      },
    });
  });

  it("should handle non-standard errors", async () => {
    global.fetch = jest.fn(() => Promise.reject("an error occurred"));

    const reduxFetch = fetchBaseQuery({
      baseUrl: "/test/",
      paramsSerializer: () => "",
    });

    const result = await reduxFetch("base", {} as FetchApiArgs, {});

    expect(result).toEqual({
      error: {
        //eslint-disable-next-line quotes
        errors: ['"an error occurred"'],
      },
    });
  });

  it("should prepend the base URL", async () => {
    const reduxFetch = fetchBaseQuery({
      baseUrl: "/test/",
      paramsSerializer: () => "",
    });

    await reduxFetch("base", {} as FetchApiArgs, {});

    expect(global.fetch).toHaveBeenCalledWith("/test/base", expect.anything());
  });

  it("should serialize parameters", async () => {
    const reduxFetch = fetchBaseQuery({
      baseUrl: "/test/",
      paramsSerializer: (params) =>
        `?${Object.entries(params)
          .map(([param, value]) => `${param}=${value}`)
          .join(",")}`,
    });

    await reduxFetch({ url: "base", params: { hello: "world" } }, {} as FetchApiArgs, {});

    expect(global.fetch).toHaveBeenCalledWith("/test/base?hello=world", expect.anything());
  });

  it("should transform headers", async () => {
    const reduxFetch = fetchBaseQuery({
      baseUrl: "/test/",
      paramsSerializer: () => "",
      transformHeaders: (headers) => {
        return Promise.resolve({ ...headers, extra: "header" });
      },
    });

    await reduxFetch({ url: "base" }, {} as FetchApiArgs, {});

    expect(global.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: {
          extra: "header",
        },
      }),
    );
  });
});
