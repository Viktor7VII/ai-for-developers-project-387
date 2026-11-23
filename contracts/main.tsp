import "@typespec/http";
import "@typespec/rest";

using Http;
using Rest;

@service(#{ title: "Call Calendar API" })
@server("http://localhost:8080", "Local development server")
namespace CallCalendar;

model HealthResponse {
  status: "UP" | "DOWN";
}

@route("/actuator/health")
@get
op health(): HealthResponse;

@doc("Error details returned for failed requests.")
@error
model ErrorResponse {
  message: string;
}

@doc("Bad request: validation failed.")
model BadRequestError {
  @statusCode statusCode: 400;
  @body body: ErrorResponse;
}

@doc("Resource not found.")
model NotFoundError {
  @statusCode statusCode: 404;
  @body body: ErrorResponse;
}

@doc("Conflict with existing data.")
model ConflictError {
  @statusCode statusCode: 409;
  @body body: ErrorResponse;
}

@doc("A type of meeting that guests can book.")
model EventType {
  id: int64;
  ...EventTypeInput;
}

@doc("Event type data sent by the owner when creating or updating an event type.")
model EventTypeInput {
  @doc("Unique URL-friendly identifier used in the public booking link.")
  @minLength(1)
  @maxLength(100)
  @pattern("^[a-z0-9]+(?:-[a-z0-9]+)*$")
  slug: string;

  @doc("Must contain at least one non-whitespace character.")
  @minLength(1)
  @maxLength(200)
  @pattern("^[\\s\\S]*\\S[\\s\\S]*$")
  title: string;

  @maxLength(2000)
  description?: string;

  @doc("Meeting duration in minutes.")
  @minValue(5)
  @maxValue(720)
  durationMinutes: int32;
}

@tag("EventTypes")
@route("/api/event-types")
interface EventTypes {
  @doc("List all event types of the owner.")
  @get
  list(): EventType[];

  @doc("Get an event type by id.")
  @get
  get(@path id: int64): EventType | NotFoundError;

  @doc("Create a new event type.")
  @post
  create(@body eventType: EventTypeInput):
    | {
        @statusCode statusCode: 201;
        @body body: EventType;
      }
    | BadRequestError
    | ConflictError;

  @doc("Update an existing event type.")
  @put
  update(@path id: int64, @body eventType: EventTypeInput):
    | EventType
    | BadRequestError
    | NotFoundError
    | ConflictError;

  @doc("Delete an event type. Allowed only when no bookings reference it; otherwise 409.")
  @delete
  delete(@path id: int64):
    | {
        @statusCode statusCode: 204;
      }
    | NotFoundError
    | ConflictError;
}

enum DayOfWeek {
  MONDAY,
  TUESDAY,
  WEDNESDAY,
  THURSDAY,
  FRIDAY,
  SATURDAY,
  SUNDAY,
}

@doc("Local time of day in 24-hour HH:mm format.")
@pattern("^([01][0-9]|2[0-3]):[0-5][0-9]$")
scalar TimeOfDay extends string;

@doc("A recurring weekly time range when the owner is available.")
model WeeklyInterval {
  dayOfWeek: DayOfWeek;

  @doc("Start time (inclusive) in the schedule time zone.")
  startTime: TimeOfDay;

  @doc("End time (exclusive) in the schedule time zone. Must be after startTime.")
  endTime: TimeOfDay;
}

@doc("Weekly availability of the owner.")
model Schedule {
  @doc("IANA time zone identifier of the schedule, e.g. Europe/Moscow or UTC. Fixed offsets such as +03:00 are rejected.")
  @minLength(1)
  @maxLength(64)
  timeZone: string;

  @doc("Available intervals. Intervals of the same day must not overlap. Empty list means no availability.")
  @maxItems(100)
  intervals: WeeklyInterval[];
}

@tag("Schedule")
@route("/api/schedule")
interface Schedules {
  @doc("Get the owner's weekly schedule. Returns a default Mon-Fri 09:00-17:00 schedule if none was saved.")
  @get
  get(): Schedule;

  @doc("Replace the owner's weekly schedule. Existing bookings are not affected.")
  @put
  update(@body schedule: Schedule): Schedule | BadRequestError;
}

@doc("A free time slot that can be booked.")
model TimeSlot {
  startAt: utcDateTime;
  endAt: utcDateTime;
}

enum BookingStatus {
  CONFIRMED,
}

@doc("Data entered by a visitor to book a time slot.")
model BookingRequest {
  @doc("Start of the selected slot. Must be one of the slots returned by the slots endpoint.")
  startAt: utcDateTime;

  @doc("Must contain at least one non-whitespace character.")
  @minLength(1)
  @maxLength(200)
  @pattern("^[\\s\\S]*\\S[\\s\\S]*$")
  guestName: string;

  @minLength(3)
  @maxLength(320)
  @pattern("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
  guestEmail: string;
}

@doc("A confirmed meeting booked by a visitor, as shown in the owner area.")
model Booking {
  id: int64;
  eventTypeId: int64;
  eventTypeTitle: string;
  guestName: string;
  guestEmail: string;
  startAt: utcDateTime;
  endAt: utcDateTime;
  status: BookingStatus;
  createdAt: utcDateTime;
}

@doc("""
  A confirmed meeting as returned to the guest who booked it.
  Kept separate from the owner model so that owner-only booking data never reaches guests.
  """)
model GuestBooking {
  id: int64;
  eventTypeId: int64;
  eventTypeTitle: string;
  guestName: string;
  guestEmail: string;
  startAt: utcDateTime;
  endAt: utcDateTime;
  status: BookingStatus;
  createdAt: utcDateTime;
}

@doc("Public endpoints used by visitors without registration.")
@tag("PublicBooking")
@route("/api/public/event-types/{slug}")
interface PublicBooking {
  @doc("Get public information about an event type.")
  @get
  getEventType(@path slug: string): EventType | NotFoundError;

  @doc("""
    List all free slots of the event type within the booking window:
    today and the next 13 calendar days in the owner time zone.
    Slots that already started and slots overlapping existing bookings are excluded.
    """)
  @route("/slots")
  @get
  listSlots(@path slug: string): TimeSlot[] | NotFoundError;

  @doc("""
    Book a slot. Availability is re-checked on the server;
    409 is returned if the slot is taken, in the past or outside the schedule.
    """)
  @route("/bookings")
  @post
  createBooking(@path slug: string, @body booking: BookingRequest):
    | {
        @statusCode statusCode: 201;
        @body body: GuestBooking;
      }
    | BadRequestError
    | NotFoundError
    | ConflictError;
}

@tag("Bookings")
@route("/api/bookings")
interface Bookings {
  @doc("List all bookings of the owner ordered by start time.")
  @get
  list(): Booking[];
}
