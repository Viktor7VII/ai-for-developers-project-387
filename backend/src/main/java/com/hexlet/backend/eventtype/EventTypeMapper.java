package com.hexlet.backend.eventtype;

/** Maps the event type entity to the generated API model. */
public final class EventTypeMapper {

	private EventTypeMapper() {
	}

	public static com.hexlet.backend.api.model.EventType toDto(EventType eventType) {
		return new com.hexlet.backend.api.model.EventType()
				.id(eventType.getId())
				.slug(eventType.getSlug())
				.title(eventType.getTitle())
				.description(eventType.getDescription())
				.durationMinutes(eventType.getDurationMinutes());
	}
}
