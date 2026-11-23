# BookingsApi

All URIs are relative to *http://localhost:8080*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**bookingsList**](BookingsApi.md#bookingslist) | **GET** /api/bookings |  |



## bookingsList

> Array&lt;Booking&gt; bookingsList()



List all bookings of the owner ordered by start time.

### Example

```ts
import {
  Configuration,
  BookingsApi,
} from '';
import type { BookingsListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BookingsApi();

  try {
    const data = await api.bookingsList();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**Array&lt;Booking&gt;**](Booking.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

