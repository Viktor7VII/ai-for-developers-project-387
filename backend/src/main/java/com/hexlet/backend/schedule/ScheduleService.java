package com.hexlet.backend.schedule;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;

import com.hexlet.backend.common.BadRequestException;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ScheduleService {

	static final String DEFAULT_TIME_ZONE = "UTC";

	static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");

	static final Comparator<WeeklyInterval> INTERVAL_ORDER = Comparator
			.comparing(WeeklyInterval::getDayOfWeek)
			.thenComparing(WeeklyInterval::getStartTime);

	/** An interval as sent by the owner; times are already checked to be HH:mm by the contract. */
	public record IntervalInput(DayOfWeek dayOfWeek, String startTime, String endTime) {
	}

	private final ScheduleRepository repository;

	public ScheduleService(ScheduleRepository repository) {
		this.repository = repository;
	}

	/**
	 * Returns the saved owner schedule or the default one (Mon-Fri 09:00-17:00 UTC) if nothing was saved yet.
	 * The default schedule is not persisted.
	 */
	@Transactional(readOnly = true)
	public Schedule getSchedule() {
		return repository.findById(Schedule.OWNER_SCHEDULE_ID).orElseGet(ScheduleService::defaultSchedule);
	}

	/** Replaces the whole schedule. Existing bookings are not affected. */
	@Transactional
	public Schedule update(String timeZone, List<IntervalInput> intervalInputs) {
		String zone = parseTimeZone(timeZone);
		List<WeeklyInterval> intervals = intervalInputs.stream()
				.map(ScheduleService::toInterval)
				.sorted(INTERVAL_ORDER)
				.toList();
		ensureNoOverlaps(intervals);

		Schedule schedule = repository.findById(Schedule.OWNER_SCHEDULE_ID)
				.orElseGet(() -> new Schedule(Schedule.OWNER_SCHEDULE_ID, zone, List.of()));
		schedule.replace(zone, intervals);
		return repository.saveAndFlush(schedule);
	}

	static Schedule defaultSchedule() {
		LocalTime start = LocalTime.of(9, 0);
		LocalTime end = LocalTime.of(17, 0);
		List<WeeklyInterval> intervals = List.of(
						DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
						DayOfWeek.THURSDAY, DayOfWeek.FRIDAY)
				.stream()
				.map(day -> new WeeklyInterval(day, start, end))
				.toList();
		return new Schedule(Schedule.OWNER_SCHEDULE_ID, DEFAULT_TIME_ZONE, intervals);
	}

	/** Only IANA time zone identifiers are accepted; fixed offsets like "+03:00" or "UTC+3" are rejected. */
	private static String parseTimeZone(String timeZone) {
		String id = timeZone.strip();
		if (!ZoneId.getAvailableZoneIds().contains(id)) {
			throw new BadRequestException("timeZone: '" + timeZone + "' is not an IANA time zone");
		}
		return id;
	}

	private static WeeklyInterval toInterval(IntervalInput input) {
		LocalTime start = LocalTime.parse(input.startTime(), TIME_FORMAT);
		LocalTime end = LocalTime.parse(input.endTime(), TIME_FORMAT);
		if (!start.isBefore(end)) {
			throw new BadRequestException(
					"intervals: " + input.dayOfWeek() + " " + input.startTime() + "-" + input.endTime()
							+ " has endTime that is not after startTime");
		}
		return new WeeklyInterval(input.dayOfWeek(), start, end);
	}

	/** Expects intervals sorted by day and start time. Adjacent intervals (end == next start) are allowed. */
	private static void ensureNoOverlaps(List<WeeklyInterval> intervals) {
		for (int i = 1; i < intervals.size(); i++) {
			WeeklyInterval previous = intervals.get(i - 1);
			WeeklyInterval current = intervals.get(i);
			if (previous.getDayOfWeek() == current.getDayOfWeek()
					&& current.getStartTime().isBefore(previous.getEndTime())) {
				throw new BadRequestException(
						"intervals: " + current.getDayOfWeek() + " intervals "
								+ format(previous) + " and " + format(current) + " overlap");
			}
		}
	}

	private static String format(WeeklyInterval interval) {
		return interval.getStartTime().format(TIME_FORMAT) + "-" + interval.getEndTime().format(TIME_FORMAT);
	}
}
