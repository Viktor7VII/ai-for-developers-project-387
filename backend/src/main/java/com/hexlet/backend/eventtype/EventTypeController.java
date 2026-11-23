package com.hexlet.backend.eventtype;

import java.util.List;

import com.hexlet.backend.api.EventTypesApi;
import com.hexlet.backend.api.model.EventTypeInput;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

/**
 * Owner operations on event types. Paths, parameters and validation come from the generated
 * {@link EventTypesApi} (contract-first, ADR-0003).
 */
@RestController
public class EventTypeController implements EventTypesApi {

	private final EventTypeService service;

	public EventTypeController(EventTypeService service) {
		this.service = service;
	}

	@Override
	public ResponseEntity<List<com.hexlet.backend.api.model.EventType>> eventTypesList() {
		return ResponseEntity.ok(service.list().stream().map(EventTypeMapper::toDto).toList());
	}

	@Override
	public ResponseEntity<com.hexlet.backend.api.model.EventType> eventTypesGet(Long id) {
		return ResponseEntity.ok(EventTypeMapper.toDto(service.get(id)));
	}

	@Override
	public ResponseEntity<com.hexlet.backend.api.model.EventType> eventTypesCreate(EventTypeInput input) {
		EventType created = service.create(
				input.getSlug(), input.getTitle(), input.getDescription(), input.getDurationMinutes());
		return ResponseEntity.status(HttpStatus.CREATED).body(EventTypeMapper.toDto(created));
	}

	@Override
	public ResponseEntity<com.hexlet.backend.api.model.EventType> eventTypesUpdate(Long id, EventTypeInput input) {
		EventType updated = service.update(
				id, input.getSlug(), input.getTitle(), input.getDescription(), input.getDurationMinutes());
		return ResponseEntity.ok(EventTypeMapper.toDto(updated));
	}

	@Override
	public ResponseEntity<Void> eventTypesDelete(Long id) {
		service.delete(id);
		return ResponseEntity.noContent().build();
	}
}
