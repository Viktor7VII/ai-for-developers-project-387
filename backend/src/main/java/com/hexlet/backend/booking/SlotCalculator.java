package com.hexlet.backend.booking;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import com.hexlet.backend.schedule.WeeklyInterval;

/**
 * Pure slot generation logic, independent of Spring and the database.
 *
 * <p>Each weekly interval is split into consecutive slots of the meeting duration, starting at the
 * interval start. A slot is returned if it fits completely into the interval, starts within
 * [from, to), starts after {@code now} and does not overlap any busy period.
 */
public final class SlotCalculator {

	private SlotCalculator() {
	}

	public static List<TimeSlot> calculate(
			ZoneId zone,
			List<WeeklyInterval> intervals,
			Duration duration,
			Instant from,
			Instant to,
			Instant now,
			List<TimeSlot> busy
	) {
		if (duration.isZero() || duration.isNegative()) {
			throw new IllegalArgumentException("duration must be positive");
		}
		List<WeeklyInterval> sortedIntervals = intervals.stream()
				.sorted(Comparator.comparing(WeeklyInterval::getStartTime))
				.toList();

		List<TimeSlot> result = new ArrayList<>();
		LocalDate lastDay = to.atZone(zone).toLocalDate();
		for (LocalDate day = from.atZone(zone).toLocalDate(); !day.isAfter(lastDay); day = day.plusDays(1)) {
			for (WeeklyInterval interval : sortedIntervals) {
				if (interval.getDayOfWeek() != day.getDayOfWeek()) {
					continue;
				}
				// atZone() resolves DST gaps/overlaps; arithmetic below is done on instants.
				Instant windowStart = day.atTime(interval.getStartTime()).atZone(zone).toInstant();
				Instant windowEnd = day.atTime(interval.getEndTime()).atZone(zone).toInstant();
				for (Instant start = windowStart;
						!start.plus(duration).isAfter(windowEnd);
						start = start.plus(duration)) {
					TimeSlot slot = new TimeSlot(start, start.plus(duration));
					if (isBookable(slot, from, to, now, busy)) {
						result.add(slot);
					}
				}
			}
		}
		return result;
	}

	private static boolean isBookable(TimeSlot slot, Instant from, Instant to, Instant now, List<TimeSlot> busy) {
		Instant start = slot.startAt();
		if (start.isBefore(from) || !start.isBefore(to) || !start.isAfter(now)) {
			return false;
		}
		return busy.stream().noneMatch(slot::overlaps);
	}
}
