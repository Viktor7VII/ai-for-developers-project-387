
# GuestBooking

A confirmed meeting as returned to the guest who booked it. Kept separate from the owner model so that owner-only booking data never reaches guests.

## Properties

Name | Type
------------ | -------------
`id` | number
`eventTypeId` | number
`eventTypeTitle` | string
`guestName` | string
`guestEmail` | string
`startAt` | Date
`endAt` | Date
`status` | [BookingStatus](BookingStatus.md)
`createdAt` | Date
`topic` | string

## Example

```typescript
import type { GuestBooking } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "eventTypeId": null,
  "eventTypeTitle": null,
  "guestName": null,
  "guestEmail": null,
  "startAt": null,
  "endAt": null,
  "status": null,
  "createdAt": null,
  "topic": null,
} satisfies GuestBooking

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GuestBooking
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


