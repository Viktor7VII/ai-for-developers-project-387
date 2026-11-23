package com.hexlet.backend.schedule;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

/**
 * Weekly availability of the owner. The application has a single owner,
 * so there is exactly one schedule row with a fixed id.
 */
@Entity
@Table(name = "schedules")
public class Schedule {

	public static final long OWNER_SCHEDULE_ID = 1L;

	@Id
	private Long id;

	@Column(nullable = false, length = 64)
	private String timeZone;

	@ElementCollection(fetch = FetchType.EAGER)
	@CollectionTable(name = "schedule_intervals", joinColumns = @JoinColumn(name = "schedule_id"))
	private List<WeeklyInterval> intervals = new ArrayList<>();

	protected Schedule() {
	}

	public Schedule(long id, String timeZone, List<WeeklyInterval> intervals) {
		this.id = id;
		replace(timeZone, intervals);
	}

	public void replace(String timeZone, List<WeeklyInterval> intervals) {
		this.timeZone = timeZone;
		this.intervals.clear();
		this.intervals.addAll(intervals);
	}

	public Long getId() {
		return id;
	}

	public String getTimeZone() {
		return timeZone;
	}

	public List<WeeklyInterval> getIntervals() {
		return List.copyOf(intervals);
	}
}
