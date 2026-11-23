package com.hexlet.backend.eventtype;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "event_types")
public class EventType {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 100)
	private String slug;

	@Column(nullable = false, length = 200)
	private String title;

	@Column(length = 2000)
	private String description;

	@Column(nullable = false)
	private int durationMinutes;

	protected EventType() {
	}

	public EventType(String slug, String title, String description, int durationMinutes) {
		update(slug, title, description, durationMinutes);
	}

	public void update(String slug, String title, String description, int durationMinutes) {
		this.slug = slug;
		this.title = title;
		this.description = description;
		this.durationMinutes = durationMinutes;
	}

	public Long getId() {
		return id;
	}

	public String getSlug() {
		return slug;
	}

	public String getTitle() {
		return title;
	}

	public String getDescription() {
		return description;
	}

	public int getDurationMinutes() {
		return durationMinutes;
	}
}
