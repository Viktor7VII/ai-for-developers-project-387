
# WeeklyInterval

A recurring weekly time range when the owner is available.

## Properties

Name | Type
------------ | -------------
`dayOfWeek` | [DayOfWeek](DayOfWeek.md)
`startTime` | string
`endTime` | string

## Example

```typescript
import type { WeeklyInterval } from ''

// TODO: Update the object below with actual values
const example = {
  "dayOfWeek": null,
  "startTime": null,
  "endTime": null,
} satisfies WeeklyInterval

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as WeeklyInterval
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


