package com.hexlet.backend.schedule;

import java.time.DayOfWeek;
import java.time.LocalTime;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

/**
 * A recurring weekly time range [startTime, endTime) in the schedule time zone.
 */
@Embeddable
public class WeeklyInterval {

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private DayOfWeek dayOfWeek;

	@Column(nullable = false)
	private LocalTime startTime;

	@Column(nullable = false)
	private LocalTime endTime;

	protected WeeklyInterval() {
	}

	public WeeklyInterval(DayOfWeek dayOfWeek, LocalTime startTime, LocalTime endTime) {
		this.dayOfWeek = dayOfWeek;
		this.startTime = startTime;
		this.endTime = endTime;
	}

	public DayOfWeek getDayOfWeek() {
		return dayOfWeek;
	}

	public LocalTime getStartTime() {
		return startTime;
	}

	public LocalTime getEndTime() {
		return endTime;
	}
}
