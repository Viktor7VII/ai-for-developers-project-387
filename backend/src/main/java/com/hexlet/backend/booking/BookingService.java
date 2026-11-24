package com.hexlet.backend.booking;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import com.hexlet.backend.common.BadRequestException;
import com.hexlet.backend.common.BookingLock;
import com.hexlet.backend.common.ConflictException;
import com.hexlet.backend.common.NotFoundException;
import com.hexlet.backend.eventtype.EventType;
import com.hexlet.backend.eventtype.EventTypeService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class BookingService {

	private final EventTypeService eventTypeService;
	private final SlotService slotService;
	private final BookingRepository bookingRepository;
	private final TransactionTemplate transactionTemplate;
	private final Clock clock;

	/**
	 * Serializes "check availability + insert" with other bookings and with event type deletion
	 * (ADR-0002). The lock is held until the transaction commits; the unique start constraint is a
	 * database-level guard.
	 */
	private final BookingLock bookingLock;

	public BookingService(
			EventTypeService eventTypeService,
			SlotService slotService,
			BookingRepository bookingRepository,
			PlatformTransactionManager transactionManager,
			BookingLock bookingLock,
			Clock clock
	) {
		this.eventTypeService = eventTypeService;
		this.slotService = slotService;
		this.bookingRepository = bookingRepository;
		this.transactionTemplate = new TransactionTemplate(transactionManager);
		this.bookingLock = bookingLock;
		this.clock = clock;
	}

	/** Free slots of the event type within the booking window. */
	@Transactional(readOnly = true)
	public List<TimeSlot> listFreeSlots(String slug) {
		return slotService.findFreeSlots(eventTypeService.findBySlug(slug));
	}

	public Booking create(String slug, Instant startAt, String guestName, String guestEmail) {
		return create(slug, startAt, guestName, guestEmail, null);
	}

	/**
	 * Creates a booking; the optional guest topic is trimmed, a blank topic means "no topic". The topic
	 * length is checked before availability, so a too long topic is a 400 even for a taken slot and never
	 * takes the slot.
	 */
	public Booking create(String slug, Instant startAt, String guestName, String guestEmail, String topic) {
		String normalizedTopic = normalizeTopic(topic);
		if (normalizedTopic != null && normalizedTopic.length() > Booking.TOPIC_MAX_LENGTH) {
			throw new BadRequestException(
					"Topic must be at most " + Booking.TOPIC_MAX_LENGTH + " characters after trimming");
		}
		return bookingLock.runLocked(() -> transactionTemplate.execute(
				status -> createInTransaction(slug, startAt, guestName, guestEmail, normalizedTopic)));
	}

	@Transactional(readOnly = true)
	public List<Booking> listAll() {
		return bookingRepository.findAllWithEventTypeOrderByStartAt();
	}

	/**
	 * Sets the owner note of a booking, upcoming or past. The note is trimmed; a blank note means
	 * "no note". The note doesn't affect availability, so the booking lock (ADR-0002) isn't needed.
	 */
	@Transactional
	public Booking updateNote(long id, String note) {
		Booking booking = bookingRepository.findWithEventTypeById(id)
				.orElseThrow(() -> new NotFoundException("Booking " + id + " not found"));
		String normalized = note.strip();
		if (normalized.length() > Booking.NOTE_MAX_LENGTH) {
			throw new BadRequestException(
					"Note must be at most " + Booking.NOTE_MAX_LENGTH + " characters after trimming");
		}
		booking.changeNote(normalized.isEmpty() ? null : normalized);
		return booking;
	}

	private static String normalizeTopic(String topic) {
		if (topic == null || topic.isBlank()) {
			return null;
		}
		return topic.strip();
	}

	private Booking createInTransaction(
			String slug, Instant startAt, String guestName, String guestEmail, String topic) {
		EventType eventType = eventTypeService.findBySlug(slug);
		// Re-checks the booking window, slot grid, schedule and overlaps with all bookings.
		if (!slotService.isFree(eventType, startAt)) {
			throw new ConflictException("Selected time slot is not available");
		}
		Booking booking = new Booking(
				eventType,
				guestName.strip(),
				guestEmail.strip(),
				startAt,
				startAt.plus(Duration.ofMinutes(eventType.getDurationMinutes())),
				// Millisecond precision: same value in the response and in the database, and JS-friendly.
				clock.instant().truncatedTo(ChronoUnit.MILLIS),
				topic
		);
		return bookingRepository.saveAndFlush(booking);
	}
}
