# ApiUtils

Typescript SDK for interacting with Meraki's public API.

The goal is to create a library that is used across Meraki applications that need to interact with our public API. We want a consistent pattern for doing this that still supports Meraki's API features.
- Supports our [pagination](https://docs.ikarem.io/display/ENG/Pagination+in+the+Dashboard+API) that uses Link header
- Supports error handling for our API's standard error responses

Features coming soon:
- [Action Batches](https://docs.ikarem.io/display/ENG/Actions%2C+Entities%2C+and+Batches) libraries this code needs to be ported over from `manage` to this package
- React hook to use `apiResponse`
- Integration with [React Toolkit Query](https://docs.ikarem.io/display/EngMSTeam/How+to%3A+rtk-query+and+mkiredux)
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
  data: string
}>
```

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
yarn add apiutils
```
```
npm install apiutils
```

##### Usage
```
import { apiRequest } from "apiutils";

...

const url = `/api/v1/networks/${networkId}/webhooks/webhookTests`
const data = {
  url: "https://webhook.site/#!/61296b81-3980-4473-89e9-4b3c8ef0a70e",
  payloadTemplateId: "wpt_00002",
}

apiRequest("POST", url, data)
```

To use in a consumer of this library, you can either use `async`/`await` or promise chaining
##### async/await
```
try {
  await apiRequest("GET", "www.some-url.com");
  /* carry on */
} catch (badResponse) {
  /* do something with badResponse.errors */
}
```
##### promise chaining
```
apiRequest("GET", "www.some-url.com")
  .then(() => /* carry on */)
  .catch((badResponse) => /* do something with badResponse.errors */);
```
### isApiError()
For checking errors, the library also provides a type guard helper function to ensure that the errors are in the format we expect before using them.
```
try {
  await apiRequest("GET", "www.bad-url.com");
  /* carry on */
} catch (badResponse) {
  if(isApiError(badResponse)) {
    /* do something with badResponse.errors */
  } else {
    /* we don't know what format errors are in, so just log them */
  }
}
```
