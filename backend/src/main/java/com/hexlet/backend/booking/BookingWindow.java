package com.hexlet.backend.booking;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * The booking window (see GLOSSARY.md): today and the next 13 calendar days in the owner time zone,
 * as the half-open range [00:00 of today, 00:00 of the fifteenth day). A slot belongs to the window
 * when its start does.
 */
public record BookingWindow(Instant start, Instant end) {

	public static final int DAYS = 14;

	public static BookingWindow of(Instant now, ZoneId ownerZone) {
		LocalDate today = now.atZone(ownerZone).toLocalDate();
		// atStartOfDay(zone) resolves a DST gap at midnight to the first valid instant of the day.
		return new BookingWindow(
				today.atStartOfDay(ownerZone).toInstant(),
				today.plusDays(DAYS).atStartOfDay(ownerZone).toInstant());
	}

	public boolean contains(Instant instant) {
		return !instant.isBefore(start) && instant.isBefore(end);
	}
}
