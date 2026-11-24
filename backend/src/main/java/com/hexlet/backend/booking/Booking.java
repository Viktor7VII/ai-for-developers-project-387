package com.hexlet.backend.booking;

import java.time.Instant;

import com.hexlet.backend.eventtype.EventType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * A booked meeting. Start and end are stored as absolute instants,
 * so later schedule changes never affect existing bookings.
 */
@Entity
@Table(
		name = "bookings",
		// The owner can't have two meetings starting at the same moment: a database-level safety net.
		uniqueConstraints = @UniqueConstraint(name = "uk_bookings_start_at", columnNames = "start_at"),
		indexes = @Index(name = "ix_bookings_end_at", columnList = "end_at")
)
public class Booking {

	/** Maximum owner note length after trimming. */
	public static final int NOTE_MAX_LENGTH = 1000;

	/** Maximum guest topic length after trimming. */
	public static final int TOPIC_MAX_LENGTH = 1000;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "event_type_id", nullable = false)
	private EventType eventType;

	@Column(nullable = false, length = 200)
	private String guestName;

	@Column(nullable = false, length = 320)
	private String guestEmail;

	@Column(name = "start_at", nullable = false)
	private Instant startAt;

	@Column(name = "end_at", nullable = false)
	private Instant endAt;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private BookingStatus status;

	@Column(nullable = false)
	private Instant createdAt;

	/** Topic given by the guest when booking; set only on creation, null when there is no topic. */
	@Column(length = TOPIC_MAX_LENGTH)
	private String topic;

	/** Owner note, never shown to guests; null when the booking has no note. */
	@Column(length = NOTE_MAX_LENGTH)
	private String note;

	protected Booking() {
	}

	public Booking(EventType eventType, String guestName, String guestEmail,
			Instant startAt, Instant endAt, Instant createdAt) {
		this(eventType, guestName, guestEmail, startAt, endAt, createdAt, null);
	}

	public Booking(EventType eventType, String guestName, String guestEmail,
			Instant startAt, Instant endAt, Instant createdAt, String topic) {
		this.eventType = eventType;
		this.guestName = guestName;
		this.guestEmail = guestEmail;
		this.startAt = startAt;
		this.endAt = endAt;
		this.status = BookingStatus.CONFIRMED;
		this.createdAt = createdAt;
		this.topic = topic;
	}

	public Long getId() {
		return id;
	}

	public EventType getEventType() {
		return eventType;
	}

	public String getGuestName() {
		return guestName;
	}

	public String getGuestEmail() {
		return guestEmail;
	}

	public Instant getStartAt() {
		return startAt;
	}

	public Instant getEndAt() {
		return endAt;
	}

	public BookingStatus getStatus() {
		return status;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public String getTopic() {
		return topic;
	}

	public String getNote() {
		return note;
	}

	/** Sets the owner note; the other booking data never changes after creation. */
	void changeNote(String note) {
		this.note = note;
	}
}
