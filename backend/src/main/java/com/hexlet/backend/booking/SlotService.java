package com.hexlet.backend.booking;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

import com.hexlet.backend.eventtype.EventType;
import com.hexlet.backend.schedule.Schedule;
import com.hexlet.backend.schedule.ScheduleService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SlotService {

	private final ScheduleService scheduleService;
	private final BookingRepository bookingRepository;
	private final Clock clock;

	public SlotService(ScheduleService scheduleService, BookingRepository bookingRepository, Clock clock) {
		this.scheduleService = scheduleService;
		this.bookingRepository = bookingRepository;
		this.clock = clock;
	}

	/** All free slots of the event type within the current booking window. */
	@Transactional(readOnly = true)
	public List<TimeSlot> findFreeSlots(EventType eventType) {
		Schedule schedule = scheduleService.getSchedule();
		ZoneId zone = ZoneId.of(schedule.getTimeZone());
		Instant now = clock.instant();
		BookingWindow window = BookingWindow.of(now, zone);
		return calculate(schedule, zone, eventType, window.start(), window.end(), now);
	}

	/** Whether a slot starting exactly at {@code startAt} is free and inside the current booking window. */
	@Transactional(readOnly = true)
	public boolean isFree(EventType eventType, Instant startAt) {
		Schedule schedule = scheduleService.getSchedule();
		ZoneId zone = ZoneId.of(schedule.getTimeZone());
		Instant now = clock.instant();
		if (!BookingWindow.of(now, zone).contains(startAt)) {
			return false;
		}
		return calculate(schedule, zone, eventType, startAt, startAt.plusNanos(1), now).stream()
				.anyMatch(slot -> slot.startAt().equals(startAt));
	}

	private List<TimeSlot> calculate(Schedule schedule, ZoneId zone, EventType eventType,
			Instant from, Instant to, Instant now) {
		Duration duration = Duration.ofMinutes(eventType.getDurationMinutes());
		// The owner is a single person: bookings of any event type make the time busy.
		List<TimeSlot> busy = bookingRepository.findOverlapping(from, to.plus(duration)).stream()
				.map(booking -> new TimeSlot(booking.getStartAt(), booking.getEndAt()))
				.toList();
		return SlotCalculator.calculate(zone, schedule.getIntervals(), duration, from, to, now, busy);
	}
}
