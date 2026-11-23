package com.hexlet.backend.booking;

import java.time.Instant;

/**
 * A half-open time range [startAt, endAt). Used both for free slots and busy periods.
 */
public record TimeSlot(Instant startAt, Instant endAt) {

	boolean overlaps(TimeSlot other) {
		return startAt.isBefore(other.endAt) && other.startAt.isBefore(endAt);
	}
}
