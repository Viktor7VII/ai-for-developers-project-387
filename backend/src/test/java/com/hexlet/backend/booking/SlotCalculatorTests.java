package com.hexlet.backend.booking;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import com.hexlet.backend.schedule.WeeklyInterval;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SlotCalculatorTests {

	private static final ZoneId UTC = ZoneOffset.UTC;

	// 2026-11-16 is a Monday.
	private static final Instant MONDAY = Instant.parse("2026-11-16T00:00:00Z");
	private static final Instant TUESDAY = Instant.parse("2026-11-17T00:00:00Z");
	private static final Instant LONG_AGO = Instant.parse("2000-01-01T00:00:00Z");

	@Test
	void splitsIntervalIntoSlotsOfMeetingDuration() {
		List<TimeSlot> slots = calculate(UTC, List.of(interval(DayOfWeek.MONDAY, "09:00", "11:00")),
				30, MONDAY, TUESDAY, LONG_AGO, List.of());

		assertEquals(starts("2026-11-16T09:00:00Z", "2026-11-16T09:30:00Z",
				"2026-11-16T10:00:00Z", "2026-11-16T10:30:00Z"), startsOf(slots));
		assertEquals(Instant.parse("2026-11-16T09:30:00Z"), slots.getFirst().endAt());
	}

	@Test
	void skipsSlotThatDoesNotFitIntoInterval() {
		List<TimeSlot> slots = calculate(UTC, List.of(interval(DayOfWeek.MONDAY, "09:00", "10:00")),
				45, MONDAY, TUESDAY, LONG_AGO, List.of());

		assertEquals(starts("2026-11-16T09:00:00Z"), startsOf(slots));
	}

	@Test
	void usesOnlyMatchingDaysOfWeekAndSortsResult() {
		List<WeeklyInterval> intervals = List.of(
				interval(DayOfWeek.WEDNESDAY, "10:00", "11:00"),
				interval(DayOfWeek.MONDAY, "15:00", "16:00"),
				interval(DayOfWeek.MONDAY, "09:00", "10:00"));

		List<TimeSlot> slots = calculate(UTC, intervals, 60,
				MONDAY, Instant.parse("2026-11-23T00:00:00Z"), LONG_AGO, List.of());

		assertEquals(starts("2026-11-16T09:00:00Z", "2026-11-16T15:00:00Z", "2026-11-18T10:00:00Z"),
				startsOf(slots));
	}

	@Test
	void returnsNothingForEmptySchedule() {
		assertTrue(calculate(UTC, List.of(), 30, MONDAY, TUESDAY, LONG_AGO, List.of()).isEmpty());
	}

	@Test
	void excludesSlotsStartingAtOrBeforeNow() {
		Instant now = Instant.parse("2026-11-16T09:30:00Z");

		List<TimeSlot> slots = calculate(UTC, List.of(interval(DayOfWeek.MONDAY, "09:00", "11:00")),
				30, MONDAY, TUESDAY, now, List.of());

		assertEquals(starts("2026-11-16T10:00:00Z", "2026-11-16T10:30:00Z"), startsOf(slots));
	}

	@Test
	void includesOnlySlotsStartingWithinRange() {
		List<TimeSlot> slots = calculate(UTC, List.of(interval(DayOfWeek.MONDAY, "09:00", "11:00")),
				30, Instant.parse("2026-11-16T09:30:00Z"), Instant.parse("2026-11-16T10:30:00Z"),
				LONG_AGO, List.of());

		assertEquals(starts("2026-11-16T09:30:00Z", "2026-11-16T10:00:00Z"), startsOf(slots));
	}

	@Test
	void excludesSlotsOverlappingBusyPeriods() {
		List<TimeSlot> busy = List.of(
				// Exactly one slot.
				new TimeSlot(Instant.parse("2026-11-16T09:00:00Z"), Instant.parse("2026-11-16T09:30:00Z")),
				// Partially overlaps 10:00-10:30 and 10:30-11:00.
				new TimeSlot(Instant.parse("2026-11-16T10:15:00Z"), Instant.parse("2026-11-16T10:45:00Z")));

		List<TimeSlot> slots = calculate(UTC, List.of(interval(DayOfWeek.MONDAY, "09:00", "11:00")),
				30, MONDAY, TUESDAY, LONG_AGO, busy);

		assertEquals(starts("2026-11-16T09:30:00Z"), startsOf(slots));
	}

	@Test
	void adjacentBusyPeriodDoesNotBlockSlot() {
		List<TimeSlot> busy = List.of(
				new TimeSlot(Instant.parse("2026-11-16T08:00:00Z"), Instant.parse("2026-11-16T09:00:00Z")));

		List<TimeSlot> slots = calculate(UTC, List.of(interval(DayOfWeek.MONDAY, "09:00", "10:00")),
				60, MONDAY, TUESDAY, LONG_AGO, busy);

		assertEquals(starts("2026-11-16T09:00:00Z"), startsOf(slots));
	}

	@Test
	void interpretsScheduleInItsTimeZone() {
		// Moscow is UTC+3: 09:00 local == 06:00 UTC.
		List<TimeSlot> slots = calculate(ZoneId.of("Europe/Moscow"),
				List.of(interval(DayOfWeek.MONDAY, "09:00", "10:00")),
				60, MONDAY, TUESDAY, LONG_AGO, List.of());

		assertEquals(starts("2026-11-16T06:00:00Z"), startsOf(slots));
	}

	@Test
	void findsLocalDayThatStartsBeforeRangeInUtc() {
		// Monday 01:00 in Asia/Tokyo (UTC+9) is Sunday 16:00 UTC.
		List<TimeSlot> slots = calculate(ZoneId.of("Asia/Tokyo"),
				List.of(interval(DayOfWeek.MONDAY, "01:00", "02:00")),
				60, Instant.parse("2026-11-15T12:00:00Z"), MONDAY, LONG_AGO, List.of());

		assertEquals(starts("2026-11-15T16:00:00Z"), startsOf(slots));
	}

	@Test
	void handlesDaylightSavingTimeChange() {
		// New York switches to DST on Sunday 2026-03-08: UTC-5 before, UTC-4 after.
		List<WeeklyInterval> intervals = List.of(
				interval(DayOfWeek.SATURDAY, "09:00", "10:00"),
				interval(DayOfWeek.SUNDAY, "09:00", "10:00"));

		List<TimeSlot> slots = calculate(ZoneId.of("America/New_York"), intervals, 60,
				Instant.parse("2026-03-07T00:00:00Z"), Instant.parse("2026-03-09T00:00:00Z"),
				LONG_AGO, List.of());

		assertEquals(starts("2026-03-07T14:00:00Z", "2026-03-08T13:00:00Z"), startsOf(slots));
	}

	private static List<TimeSlot> calculate(ZoneId zone, List<WeeklyInterval> intervals, int minutes,
			Instant from, Instant to, Instant now, List<TimeSlot> busy) {
		return SlotCalculator.calculate(zone, intervals, Duration.ofMinutes(minutes), from, to, now, busy);
	}

	private static WeeklyInterval interval(DayOfWeek day, String start, String end) {
		return new WeeklyInterval(day, LocalTime.parse(start), LocalTime.parse(end));
	}

	private static List<Instant> starts(String... instants) {
		return java.util.Arrays.stream(instants).map(Instant::parse).toList();
	}

	private static List<Instant> startsOf(List<TimeSlot> slots) {
		return slots.stream().map(TimeSlot::startAt).toList();
	}
}
