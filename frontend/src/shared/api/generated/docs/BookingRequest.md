
# BookingRequest

Data entered by a visitor to book a time slot.

## Properties

Name | Type
------------ | -------------
`startAt` | Date
`guestName` | string
`guestEmail` | string
`topic` | string

## Example

```typescript
import type { BookingRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "startAt": null,
  "guestName": null,
  "guestEmail": null,
  "topic": null,
} satisfies BookingRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BookingRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


