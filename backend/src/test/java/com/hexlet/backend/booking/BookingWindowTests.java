package com.hexlet.backend.booking;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BookingWindowTests {

	@Test
	void coversTodayAndTheNextThirteenDaysInOwnerZone() {
		BookingWindow window = BookingWindow.of(Instant.parse("2026-11-15T12:00:00Z"), ZoneOffset.UTC);

		assertEquals(Instant.parse("2026-11-15T00:00:00Z"), window.start());
		assertEquals(Instant.parse("2026-11-29T00:00:00Z"), window.end());
	}

	@Test
	void fourteenthDayIsIncludedAndFifteenthIsNot() {
		BookingWindow window = BookingWindow.of(Instant.parse("2026-11-15T12:00:00Z"), ZoneOffset.UTC);

		assertTrue(window.contains(Instant.parse("2026-11-28T23:59:00Z")));
		assertFalse(window.contains(Instant.parse("2026-11-29T00:00:00Z")));
		assertFalse(window.contains(Instant.parse("2026-11-14T23:59:00Z")));
	}

	@Test
	void todayIsTheOwnersCalendarDay() {
		// 16:00 UTC on the 15th is already 01:00 on the 16th in Tokyo (UTC+9).
		BookingWindow window = BookingWindow.of(Instant.parse("2026-11-15T16:00:00Z"), ZoneId.of("Asia/Tokyo"));

		assertEquals(Instant.parse("2026-11-15T15:00:00Z"), window.start()); // 16th 00:00 Tokyo
		assertEquals(Instant.parse("2026-11-29T15:00:00Z"), window.end()); // 30th 00:00 Tokyo
	}

	@Test
	void stillFourteenCalendarDaysAcrossDaylightSavingChange() {
		// New York switches to DST on 2026-03-08: the window has one 23-hour day.
		ZoneId newYork = ZoneId.of("America/New_York");
		BookingWindow window = BookingWindow.of(Instant.parse("2026-03-01T17:00:00Z"), newYork);

		assertEquals(Instant.parse("2026-03-01T05:00:00Z"), window.start()); // 00:00 EST
		assertEquals(Instant.parse("2026-03-15T04:00:00Z"), window.end()); // 00:00 EDT
	}

	@Test
	void startsAtFirstValidInstantWhenMidnightDoesNotExist() {
		// Santiago (Chile) skips 00:00-01:00 on 2026-09-06 when DST starts.
		ZoneId santiago = ZoneId.of("America/Santiago");
		BookingWindow window = BookingWindow.of(Instant.parse("2026-09-06T15:00:00Z"), santiago);

		assertEquals(Instant.parse("2026-09-06T04:00:00Z"), window.start()); // 01:00 -03
	}
}
