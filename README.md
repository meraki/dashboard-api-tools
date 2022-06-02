# @cisco-meraki/dashboard-api-tools

Typescript SDK for interacting with [Meraki's API](https://developer.cisco.com/meraki/api-v1/). This library provides an interface for Javascript and Typescript applications to interact with Cisco Meraki's cloud-managed platform.

Features:
- Support for interacting with Meraki's [Dashboard endpoints](https://developer.cisco.com/meraki/api-v1/#!overview) via `apiRequest`. This provides a wrapper around JavaScript's native `fetch` function with features specific to handling Meraki's API responses.
- Support for [pagination](https://developer.cisco.com/meraki/api-v1/#!pagination) via `makePaginatedRequest`
- Supports [error handling](https://developer.cisco.com/meraki/api-v1/#!errors/error-handling) for Meraki's standard API error responses
- Supports [Action Batches](https://developer.cisco.com/meraki/api-v1/#!action-batches-overview/action-batches) via `batchedApiRequest`
- Provides a React hook to make API requests directly from React components via `useApiRequest`
- Provides a [React Toolkit Query](https://redux-toolkit.js.org/rtk-query/overview) base query function via `fetchBaseQuery`
- Automatic retries on API requests that fail due to [rate limiting](https://developer.cisco.com/meraki/api-v1/#!rate-limit) errors

# Install
```
yarn add @cisco-meraki/dashboard-api-tools
```
```
npm install @cisco-meraki/dashboard-api-tools
```

# How to Use
## Making API Requests
### apiRequest()
`apiRequest` acts as a wrapper around Javascript's `fetch` that is strongly-typed and supports Meraki's API-specific features. Note that requests to Meraki's API [requires an API Key](https://developer.cisco.com/meraki/api-v1/#!authorization/authorization). See the section on [Providing API Key](#providing-api-key) below.

Accepted Parameters:
- `method`: HTTP method of API request. Must be one of "get", "post", "put", "delete", "options", "GET", "POST", "PUT", "DELETE", "OPTIONS"
- `url`: URL of API request,
- `data?`: Optional. Payload body for API request. Do not use this for `GET` requests. Instead, any request parameters for `GET` requests should be supplied in the URL as query parameters.
- `options?`: Optional
  - `fetchOptions`: Object that contains fields required for authenticating the API requests.
  - `auth`: Object used to store authentication options
    - `apiKey`: User's API key

#### Response
It will return objects in two possible shapes, wrapped in a promise.

For successful API requests:
```
Promise<{
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
  data: ResponseData
}>
```
Note that `data` is typed as a generic type `ResponseData`. This generic type will be passed when calling `apiRequest<ResponseData>()` and allows the consumer to set the expected data structure of the API response. Since response types vary across endpoints, we wanted to allow for flexibility in what the type of `data` should be.


For unsuccessful API requests:
```
Promise<{
  errors: string[];
  ok: false;
  statusCode: number;
  statusText: string;
}>
```
#### Providing API Key
In order to interact with the Meraki Dashboard API, you'll need to provide your API key in the `X-Cisco-Meraki-API-Key` header. If you need help obtaining this key, follow [the steps](https://developer.cisco.com/meraki/api-v1/#!authorization/obtaining-your-meraki-api-key) in our developer documentation.

```
await apiRequest(
  "POST",
  "www.some-url.com/api/v1/endpoint",
  { ... },
  {
    auth: {
      apiKey: <your API key>
    }
  }
);
```
#### Usage
```
import { apiRequest } from "@cisco-meraki/dashboard-api-tools";

...

const url = `/api/v1/networks/${networkId}/webhooks/webhookTests`
const data = {
  url: "https://webhook.site/#!/61296b81-3980-4473-89e9-4b3c8ef0a70e",
  payloadTemplateId: "wpt_00002",
}

await apiRequest<ResponseObjectType>("POST", url, data)
```
Note that `ResponseObjectType` is whatever type you expect the response object from the API request to be in.
We made this a generic as the data object can vary across endpoints.

To use in a consumer of this library, you can either use `async`/`await` or promise chaining
##### async/await
```
try {
  await apiRequest("GET", "www.some-url.com/api/v1/endpoint");
  /* carry on */
} catch (badResponse) {
  /* do something with badResponse.errors */
}
```
##### promise chaining
```
apiRequest("GET", "www.some-url.com/api/v1/endpoint")
  .then(() => /* carry on */)
  .catch((badResponse) => /* do something with badResponse.errors */);
```

***
### isApiError()
For checking errors, the library also provides a type guard helper function to ensure that the errors are in the format we expect before using them. It will verify that the failed response object contains an `error` field that is an array of strings.

Accepted Parameters:
- `response`: The return object received from the call to [`apiRequest()`](#making-api-requests)

#### Usage
```
import { apiRequest, isApiError } from "@cisco-meraki/dashboard-api-tools";

...

try {
  await apiRequest("GET", "www.some-url.com/api/v1/endpoint");
  /* carry on */
} catch (badResponse) {
  if(isApiError(badResponse)) {
    /* do something with badResponse.errors */
  } else {
    /* we don't know what format errors are in, so just log them */
  }
}
```
***

## Pagination
The return object of [`apiRequest()`](#making-api-requests) includes `firstPageUrl`, `lastPageUrl`, `prevPageUrl` and `nextPageUrl` fields that can be used by subsequent requests to get paginated data. If you want to automatically make requests to `nextPageUrl` across multiple requests, this package provides a helper function for that functionality.

### paginatedApiRequest()
This function will make paginated requests to the provided URL based on the `perPage` query parameter. It makes a request to the given URL, then makes successive requests to URLs provided in the `Link` header from the response. See [docs on pagination](https://developer.cisco.com/meraki/api-latest/#!pagination) for more details on the `Link` header.

It accepts functions that will be called for each successful response as well as any errors from unsuccessful responses.

It also accepts a parameter to set the maximum number of requests allowed for this endpoint to protect against abnormally large or infinite number of successive requests.

The method signature accepts the above 3 values as well as an object with a shape identical to the arguments provided for [`apiRequest()`](#making-api-requests)

Accepted Parameters:
- `dataHandler`: Callback that is invoked every time a successful response is received. For example, this can be a handler that dispatches a Redux action every time data is received from an endpoint.
- `errorHandler`: Callback that is invoked each time a response returns errors.
- `apiRequestParams`: Object that contains fields for each parameter used for [`apiRequest()`](#making-api-requests)
- `maxRequests`: Maximum number of paginated requests that will be made before halting all requests. The default value is 9,999.

#### Usage
```
import { paginatedApiRequest } from "@cisco-meraki/dashboard-api-tools";

...

const storeClientsInRedux = (clients) => (dispatch) => {
  dispatch(actions.updateClients(clients));
};

const storeErrorsInRedux = (errors) => (dispatch) => {
  dispatch(actions.clientFetchFailed(errors));
};

await paginatedApiRequest(storeClientsInRedux, storeErrorsInRedux, {method: "GET", url: "www.some-url.com/api/v1/endpoint}, 100);
```
***

## Action Batches
[Action Batches](https://developer.cisco.com/meraki/api-v1/#!action-batches-overview/action-batches) are a special type of Dashboard API mechanism for submitting batched configuration requests in a single synchronous or asynchronous transaction. Action Batches are ideal for bulk configuration, either in the initial provisioning process, or for rolling out wide-scale configuration changes. For example, add a switch to a network, configure all 48 ports, and set the switch’s management interface in a single POST.
### batchedApiRequest()

`batchedApiRequest` acts as a wrapper for Meraki's Action Batches. When the request is first made and the Action Batch is initially created, the status may be "pending" while waiting for the batches to complete. If so, it will poll the status of the action batch and return either an error or successful response depending on the Action Batch's status.

Accepted Parameters:
- `organizationId`: Id of the organization to run the series of API requests on.
- `actions`: Object that contains information around which API requests to include in the Action Batch. Contains these fields:
  - `resource`: URL fragment of API request
  - `operation`: Must be "create", "update" or "destroy"
  - `body`: Payload body for API request.
- `authOptions`: Object that contains fields required for authenticating the API requests.
  - `fetchOptions`: Optional options to override parameters passed to `fetch` call
  - `auth`: Object used to store authentication options
    - `apiKey`: User's API key
- `opts?`: Optional. Object that contains extra metadata for how you want the Action Batch to perform. Contains these fields:
  - `maxPollingTime`: Maximum time (in ms) before it halts requests that check on Action Batch status. Defaults to 12,000ms
  - `auth`: Time (in ms) between each request to check if Action Batch is complete. Defaults to 500ms
  - `synchronous`: Flag that tells the Action Batch to run synchronously or asynchronously.

#### Response

For successful requests:

```
Promise<{
  id: string;
  organizationId: string;
  confirmed: boolean;
  synchronous: boolean;
  status: ActionBatchStatus;
  actions: Action[];
}>

```
For unsuccessful requests:

```
Promise<{
  errors: string[];
  ok: false;
  statusCode: number;
  statusText: string;
}>

```

#### Usage

```
import { batchedApiRequest, isApiError } from "@dashboard-api/api-utils";

...

const actions = [
  {
    "resource": "/devices/QXXX-XXXX-XXXX/switchPorts/3",
    "operation": "update",
    "body": { "enabled": true }
  };
  ...
]

const authOptions = {
  auth: {
    apiKey: "your apiKey
  }
}
try {
  await batchedApiRequest(organizationId, actions, authOptions)
  /* carry on */
} catch (badResponse) {
  if (isApiError(badResponse)) {
    /* do something with badResponse.errors */
  } else {
    /* handle the errors in any way of your choice */
  }
}
```

## React Hook
If using React and not using a library such as Redux Toolkit Query that provide hooks for you, you may find some use in a custom React hook that provides consistent data fetching across components.
### useApiRequest()
React hook for interacting with Meraki's public API. It is a wrapper around `useState` and `useEffect` and uses `isApiError()` to make API requests and format the responses.

It has a method signature that accepts a generic type that represents the expected response object type, as well as two arguments:
- `apiRequestParams`: An object with a the shape identical to the arguments provided for [`apiRequest()`](#making-api-requests)
- `dependencies`: A list of dependencies that, when changed, will trigger this hook to run. This is similar to how [React's useEffect hook](https://reactjs.org/docs/hooks-effect.html) works

It returns 3 values:
- `response`: The formatted response from the API. It will be `undefined` if request was not successful.
- `errors`: Any errors returned from API response. It will be `undefined` if request was successful. The hook uses `isApiError()` to ensure that the errors returned are wrapped in an array of strings.
- `isFetching`: Status indicating whether the API request completed or not. This is useful for dynamically rendering a loading state in the UI.

#### Usage
```
import { useApiRequest } from "@cisco-meraki/dashboard-api-tools";

...

const ComponentUsingHook = () => {
  const [response, errors, isFetching] = useApiRequest<SuccessfulResponse>({method: "GET", url: "www.some-url.com/api/v1/endpoint" }, []);

  return (
    <>
      {
        isFetching && <div>Loading</div>
      }
      {
        !isFetching && response && <div>{response.data.someValueFromResponse}</div>
      }
      {
        !isFetching && errors && <div>
          {
            errors.map((error, index) => <div key={index}>{error}</div>)
          }
        </div>
      }
    </>
  );
};
```
***
## Redux Toolkit Query Integration
[Redux Toolkit Query](https://redux-toolkit.js.org/rtk-query/overview) provides an opinionated pattern for Redux logic in your React applications intended to simplify things for the developer. If your application is using RTK Query, you can use the custom base query function provided.

### fetchBaseQuery
RTK Query allows for a custom base query, which is usually just a wrapper around Javascript's native `fetch`, to be provided to customize data handling and response objects across endpoints. For this case, we have created the `fetchBaseQuery` function that integrates with RTK Query and provides a consistent way of making API requests while still allowing individual endpoints to customize requests and responses as needed.

Because `fetchBaseQuery` is using [`apiRequest()`](#making-api-requests), we can access all of the response data that we expect from our API responses.

The return object of this function includes these fields:
- `data` - This is the data returned in the response object from the API request. This comes from the `data` field from [`apiRequest()`](#making-api-requests)
- `meta` - This includes all other data from [`apiRequest()`](#making-api-requests) that is not part of the response object (i.e. `statusCode`, pagination fields, etc.). See documentation above for all fields in the return object form [`apiRequest()`](#making-api-requests).

Note that `responseHandler` and `validateStatus`, which are [expected to be part of RTK Query responses](https://redux-toolkit.js.org/rtk-query/api/fetchBaseQuery#individual-query-options), are not yet available when using this custom base query.

#### Usage
```
import { fetchBaseQuery } from "@cisco-meraki/dashboard-api-tools";

...

export const merakiApi = createApi({
  reducerPath: "merakiApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "api.meraki.com/api/v1/",
    transformHeaders: (headers: Headers) =>{
      const preparedHeaders = new Headers(headers);

      preparedHeaders.set("Accept", "application/json");
      /* add other headers here */

      return Promise.resolve(preparedHeaders);
    },
  }),
  endpoints: () => ({}),
});

```
