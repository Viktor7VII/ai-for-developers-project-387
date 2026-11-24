package com.hexlet.backend.booking;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/** Maps booking domain objects to the generated API models. Times are sent in UTC. */
final class BookingMapper {

	private BookingMapper() {
	}

	static com.hexlet.backend.api.model.Booking toDto(Booking booking) {
		return new com.hexlet.backend.api.model.Booking()
				.id(booking.getId())
				.eventTypeId(booking.getEventType().getId())
				.eventTypeTitle(booking.getEventType().getTitle())
				.guestName(booking.getGuestName())
				.guestEmail(booking.getGuestEmail())
				.startAt(utc(booking.getStartAt()))
				.endAt(utc(booking.getEndAt()))
				.status(com.hexlet.backend.api.model.BookingStatus.fromValue(booking.getStatus().name()))
				.createdAt(utc(booking.getCreatedAt()))
				.topic(booking.getTopic())
				.note(booking.getNote());
	}

	/** Booking as returned to the guest: a separate model, so owner-only data is never exposed publicly. */
	static com.hexlet.backend.api.model.GuestBooking toGuestDto(Booking booking) {
		return new com.hexlet.backend.api.model.GuestBooking()
				.id(booking.getId())
				.eventTypeId(booking.getEventType().getId())
				.eventTypeTitle(booking.getEventType().getTitle())
				.guestName(booking.getGuestName())
				.guestEmail(booking.getGuestEmail())
				.startAt(utc(booking.getStartAt()))
				.endAt(utc(booking.getEndAt()))
				.status(com.hexlet.backend.api.model.BookingStatus.fromValue(booking.getStatus().name()))
				.createdAt(utc(booking.getCreatedAt()))
				.topic(booking.getTopic());
	}

	static com.hexlet.backend.api.model.TimeSlot toDto(TimeSlot slot) {
		return new com.hexlet.backend.api.model.TimeSlot()
				.startAt(utc(slot.startAt()))
				.endAt(utc(slot.endAt()));
	}

	private static OffsetDateTime utc(Instant instant) {
		return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
	}
}
