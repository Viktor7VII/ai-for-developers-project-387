package com.hexlet.backend.schedule;

import java.time.DayOfWeek;
import java.util.List;

import com.hexlet.backend.api.ScheduleApi;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

/**
 * Owner schedule. Paths, parameters and field validation come from the generated
 * {@link ScheduleApi} (contract-first, ADR-0003).
 */
@RestController
public class ScheduleController implements ScheduleApi {

	private final ScheduleService service;

	public ScheduleController(ScheduleService service) {
		this.service = service;
	}

	@Override
	public ResponseEntity<com.hexlet.backend.api.model.Schedule> schedulesGet() {
		return ResponseEntity.ok(toDto(service.getSchedule()));
	}

	@Override
	public ResponseEntity<com.hexlet.backend.api.model.Schedule> schedulesUpdate(
			com.hexlet.backend.api.model.Schedule request) {
		List<ScheduleService.IntervalInput> intervals = request.getIntervals().stream()
				.map(interval -> new ScheduleService.IntervalInput(
						DayOfWeek.valueOf(interval.getDayOfWeek().getValue()),
						interval.getStartTime(),
						interval.getEndTime()))
				.toList();
		return ResponseEntity.ok(toDto(service.update(request.getTimeZone(), intervals)));
	}

	private static com.hexlet.backend.api.model.Schedule toDto(Schedule schedule) {
		List<com.hexlet.backend.api.model.WeeklyInterval> intervals = schedule.getIntervals().stream()
				.sorted(ScheduleService.INTERVAL_ORDER)
				.map(interval -> new com.hexlet.backend.api.model.WeeklyInterval()
						.dayOfWeek(com.hexlet.backend.api.model.DayOfWeek.fromValue(interval.getDayOfWeek().name()))
						.startTime(interval.getStartTime().format(ScheduleService.TIME_FORMAT))
						.endTime(interval.getEndTime().format(ScheduleService.TIME_FORMAT)))
				.toList();
		return new com.hexlet.backend.api.model.Schedule()
				.timeZone(schedule.getTimeZone())
				.intervals(intervals);
	}
}
