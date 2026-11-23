
# EventTypeInput

Event type data sent by the owner when creating or updating an event type.

## Properties

Name | Type
------------ | -------------
`slug` | string
`title` | string
`description` | string
`durationMinutes` | number

## Example

```typescript
import type { EventTypeInput } from ''

// TODO: Update the object below with actual values
const example = {
  "slug": null,
  "title": null,
  "description": null,
  "durationMinutes": null,
} satisfies EventTypeInput

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as EventTypeInput
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


