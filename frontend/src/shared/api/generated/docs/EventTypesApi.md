# EventTypesApi

All URIs are relative to *http://localhost:8080*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**eventTypesCreate**](EventTypesApi.md#eventtypescreate) | **POST** /api/event-types |  |
| [**eventTypesDelete**](EventTypesApi.md#eventtypesdelete) | **DELETE** /api/event-types/{id} |  |
| [**eventTypesGet**](EventTypesApi.md#eventtypesget) | **GET** /api/event-types/{id} |  |
| [**eventTypesList**](EventTypesApi.md#eventtypeslist) | **GET** /api/event-types |  |
| [**eventTypesUpdate**](EventTypesApi.md#eventtypesupdate) | **PUT** /api/event-types/{id} |  |



## eventTypesCreate

> EventType eventTypesCreate(eventTypeInput)



Create a new event type.

### Example

```ts
import {
  Configuration,
  EventTypesApi,
} from '';
import type { EventTypesCreateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EventTypesApi();

  const body = {
    // EventTypeInput
    eventTypeInput: ...,
  } satisfies EventTypesCreateRequest;

  try {
    const data = await api.eventTypesCreate(body);
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
| **eventTypeInput** | [EventTypeInput](EventTypeInput.md) |  | |

### Return type

[**EventType**](EventType.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | The request has succeeded and a new resource has been created as a result. |  -  |
| **400** | Bad request: validation failed. |  -  |
| **409** | Conflict with existing data. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## eventTypesDelete

> eventTypesDelete(id)



Delete an event type. Allowed only when no bookings reference it; otherwise 409.

### Example

```ts
import {
  Configuration,
  EventTypesApi,
} from '';
import type { EventTypesDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EventTypesApi();

  const body = {
    // number
    id: 789,
  } satisfies EventTypesDeleteRequest;

  try {
    const data = await api.eventTypesDelete(body);
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
| **id** | `number` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** | There is no content to send for this request, but the headers may be useful.  |  -  |
| **404** | Resource not found. |  -  |
| **409** | Conflict with existing data. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## eventTypesGet

> EventType eventTypesGet(id)



Get an event type by id.

### Example

```ts
import {
  Configuration,
  EventTypesApi,
} from '';
import type { EventTypesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EventTypesApi();

  const body = {
    // number
    id: 789,
  } satisfies EventTypesGetRequest;

  try {
    const data = await api.eventTypesGet(body);
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
| **id** | `number` |  | [Defaults to `undefined`] |

### Return type

[**EventType**](EventType.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **404** | Resource not found. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## eventTypesList

> Array&lt;EventType&gt; eventTypesList()



List all event types of the owner.

### Example

```ts
import {
  Configuration,
  EventTypesApi,
} from '';
import type { EventTypesListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EventTypesApi();

  try {
    const data = await api.eventTypesList();
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

[**Array&lt;EventType&gt;**](EventType.md)

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


## eventTypesUpdate

> EventType eventTypesUpdate(id, eventTypeInput)



Update an existing event type.

### Example

```ts
import {
  Configuration,
  EventTypesApi,
} from '';
import type { EventTypesUpdateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EventTypesApi();

  const body = {
    // number
    id: 789,
    // EventTypeInput
    eventTypeInput: ...,
  } satisfies EventTypesUpdateRequest;

  try {
    const data = await api.eventTypesUpdate(body);
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
| **id** | `number` |  | [Defaults to `undefined`] |
| **eventTypeInput** | [EventTypeInput](EventTypeInput.md) |  | |

### Return type

[**EventType**](EventType.md)

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
| **404** | Resource not found. |  -  |
| **409** | Conflict with existing data. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

