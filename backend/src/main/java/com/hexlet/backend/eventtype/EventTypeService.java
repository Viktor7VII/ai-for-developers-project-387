package com.hexlet.backend.eventtype;

import java.util.List;

import com.hexlet.backend.common.BookingLock;
import com.hexlet.backend.common.ConflictException;
import com.hexlet.backend.common.NotFoundException;

import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class EventTypeService {

	private final EventTypeRepository repository;
	private final BookingLock bookingLock;
	private final TransactionTemplate transactionTemplate;

	public EventTypeService(
			EventTypeRepository repository,
			BookingLock bookingLock,
			PlatformTransactionManager transactionManager
	) {
		this.repository = repository;
		this.bookingLock = bookingLock;
		this.transactionTemplate = new TransactionTemplate(transactionManager);
	}

	@Transactional(readOnly = true)
	public List<EventType> list() {
		return repository.findAllByOrderByIdAsc();
	}

	@Transactional(readOnly = true)
	public EventType get(long id) {
		return findById(id);
	}

	@Transactional(readOnly = true)
	public EventType findBySlug(String slug) {
		return repository.findBySlug(slug)
				.orElseThrow(() -> new NotFoundException("Event type '" + slug + "' not found"));
	}

	@Transactional
	public EventType create(String slug, String title, String description, int durationMinutes) {
		if (repository.existsBySlug(slug)) {
			throw slugTaken(slug);
		}
		EventType eventType = new EventType(slug, title.strip(), normalizeDescription(description), durationMinutes);
		return repository.saveAndFlush(eventType);
	}

	@Transactional
	public EventType update(long id, String slug, String title, String description, int durationMinutes) {
		EventType eventType = findById(id);
		if (repository.existsBySlugAndIdNot(slug, id)) {
			throw slugTaken(slug);
		}
		eventType.update(slug, title.strip(), normalizeDescription(description), durationMinutes);
		return repository.saveAndFlush(eventType);
	}

	/**
	 * Deletes an event type that no booking references. Runs under the same {@link BookingLock} as
	 * booking creation and keeps it until the transaction commits (ADR-0002), so "check for bookings +
	 * delete" can't interleave with "check slot + insert booking".
	 */
	public void delete(long id) {
		bookingLock.runLocked(() -> transactionTemplate.execute(status -> {
			EventType eventType = findById(id);
			if (repository.hasBookings(id)) {
				throw new ConflictException("Event type " + id + " has bookings and cannot be deleted");
			}
			repository.delete(eventType);
			repository.flush();
			return null;
		}));
	}

	private EventType findById(long id) {
		return repository.findById(id)
				.orElseThrow(() -> new NotFoundException("Event type " + id + " not found"));
	}

	private static ConflictException slugTaken(String slug) {
		return new ConflictException("Event type with slug '" + slug + "' already exists");
	}

	private static String normalizeDescription(String description) {
		if (description == null || description.isBlank()) {
			return null;
		}
		return description.strip();
	}
}
