# ScheduleApi

All URIs are relative to *http://localhost:8080*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**schedulesGet**](ScheduleApi.md#schedulesget) | **GET** /api/schedule |  |
| [**schedulesUpdate**](ScheduleApi.md#schedulesupdate) | **PUT** /api/schedule |  |



## schedulesGet

> Schedule schedulesGet()



Get the owner\&#39;s weekly schedule. Returns a default Mon-Fri 09:00-17:00 schedule if none was saved.

### Example

```ts
import {
  Configuration,
  ScheduleApi,
} from '';
import type { SchedulesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ScheduleApi();

  try {
    const data = await api.schedulesGet();
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

[**Schedule**](Schedule.md)

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


## schedulesUpdate

> Schedule schedulesUpdate(schedule)



Replace the owner\&#39;s weekly schedule. Existing bookings are not affected.

### Example

```ts
import {
  Configuration,
  ScheduleApi,
} from '';
import type { SchedulesUpdateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ScheduleApi();

  const body = {
    // Schedule
    schedule: ...,
  } satisfies SchedulesUpdateRequest;

  try {
    const data = await api.schedulesUpdate(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **schedule** | [Schedule](Schedule.md) |  | |

### Return type

[**Schedule**](Schedule.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **400** | Bad request: validation failed. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

