# @dashboard-api/api-utils

Typescript SDK for interacting with Meraki's public API.

The goal is to create a library that is used across Meraki applications that need to interact with our public API. We want a consistent pattern for doing this that still supports Meraki's API features.
- Supports our [pagination](https://docs.ikarem.io/display/ENG/Pagination+in+the+Dashboard+API) that uses Link header
- Supports error handling for our API's standard error responses
- Strongly typed response objects
- React hook to use `apiResponse`
- Integration with [React Toolkit Query](https://docs.ikarem.io/display/EngMSTeam/How+to%3A+rtk-query+and+mkiredux)
- Retries on 429 responses

Features coming soon:
- Pagination for more complex cases where interaction is required between each request (going backwards, going to a specific page)
- [Action Batches](https://docs.ikarem.io/display/ENG/Actions%2C+Entities%2C+and+Batches) libraries this code needs to be ported over from `manage` to this package
- Support for handling JSON error responses

For more information, please see [these docs](https://docs.ikarem.io/display/ENG/Javascript+SDK+for+Making+API+Requests).

If you need any help using this library or have feature requests, please reach out to the #dashboard-api slack channel.
# How to Use
### apiRequest()
`apiRequest` acts as a wrapper around Javascript's `fetch` that is strongly-typed and supports Meraki's API-specific features. It accepts these parameters:
```
method: HTTPMethod ("get", "post", "put", "delete", "options", "GET", "POST", "PUT", "DELETE", "OPTIONS"),
url: string,
data?: Record<string, unknown>,
options?: Options
```

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
#### Example
##### Install
```
yarn add @dashboard-api/api-utils
```
```
npm install @dashboard-api/api-utils
```

##### Usage
```
import { apiRequest } from "@dashboard-api/api-utils";

...

const url = `/api/v1/networks/${networkId}/webhooks/webhookTests`
const data = {
  url: "https://webhook.site/#!/61296b81-3980-4473-89e9-4b3c8ef0a70e",
  payloadTemplateId: "wpt_00002",
}

apiRequest<ResponseObjectType>("POST", url, data)
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
### isApiError()
For checking errors, the library also provides a type guard helper function to ensure that the errors are in the format we expect before using them. It will verify that the failed response object contains an `error` field that is an array of strings.
```
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

### paginatedApiRequest
This function will make paginated requests to the provided URL based on the `perPage` query parameter. It makes a request to the given URL, then makes successive requests to URL's provided in the `Link` header from the response. See [docs on pagination](https://docs.ikarem.io/display/ENG/Pagination+in+the+Dashboard+API) for more details on the `Link` header.

It accepts functions that will be called for each successful response as well as any errors from unsuccessful responses.

It also accepts a parameter to set the maximum number of requests allowed for this endpoint to protect against abnormally large or infinite number of successive requests.

The method signature accepts the above 3 values as well as an object with a shape identical to the arguments provided for `apiRequest`

```
type ApiRequestParams = {
  method: HTTPMethod;
  url: string;
  data?: Record<string, unknown> | undefined;
  options?: Options;
}

const paginatedApiRequest = async <ResponseData>(
  dataHandler: (data: ResponseData) => void,
  errorHandler: (errors: string[]) => void,
  apiRequestParams: ApiRequestParams,
  maxRequests = 9999,
) => {
```

##### Usage
```
const storeClientsInRedux = (clients) => (dispatch) => {
  dispatch(actions.updateClients(clients));
};

const storeErrorsInRedux = (errors) => (dispatch) => {
  dispatch(actions.clientFetchFailed(errors));
};

await paginatedApiRequest(storeClientsInRedux, storeErrorsInRedux, {method: "GET", url: "www.some-url.com/api/v1/endpoint}, 100);
```

### useApiRequest()
React hook for interacting with Meraki's public API. It is a wrapper around `useState` and `useEffect` and uses `isApiError()` to make API requests and format the responses.

It has a method signature that accepts a generic type that represents the expected response object type, as well as two arguments:
1.) An object with a the shape identical to the arguments provided for `apiRequest`
2.) A list of dependencies that, when changed, will trigger this hook to run. This is similar to how [React's useEffect hook](https://reactjs.org/docs/hooks-effect.html) works

It returns 3 values:
`response`: The formatted response fromt the API. It will be `undefined` if request was not successful.
`errors`: Any errors returned from API response. It will be `undefined` if request was successful. The hook uses `isApiError()` to ensure that the errors returned are wrapped in an array of strings.
`isFetching`: Status indicating whether the API request completed or not

```
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

# Contributing
After making changes to this project, update the version number in `package.json` and create your Merge Request.
After running automatic steps, the ci pipeline for this job will provide a manual step called "publish".
Running this step will publish the newest version of the package to Artifactory.
