package com.hexlet.backend.booking;

import java.util.List;

import com.hexlet.backend.api.PublicBookingApi;
import com.hexlet.backend.api.model.BookingRequest;
import com.hexlet.backend.eventtype.EventTypeMapper;
import com.hexlet.backend.eventtype.EventTypeService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints for guests, no registration required. Paths, parameters and field validation come from
 * the generated {@link PublicBookingApi} (contract-first, ADR-0003).
 */
@RestController
public class PublicBookingController implements PublicBookingApi {

	private final EventTypeService eventTypeService;
	private final BookingService bookingService;

	public PublicBookingController(EventTypeService eventTypeService, BookingService bookingService) {
		this.eventTypeService = eventTypeService;
		this.bookingService = bookingService;
	}

	@Override
	public ResponseEntity<com.hexlet.backend.api.model.EventType> publicBookingGetEventType(String slug) {
		return ResponseEntity.ok(EventTypeMapper.toDto(eventTypeService.findBySlug(slug)));
	}

	@Override
	public ResponseEntity<List<com.hexlet.backend.api.model.TimeSlot>> publicBookingListSlots(String slug) {
		return ResponseEntity.ok(bookingService.listFreeSlots(slug).stream().map(BookingMapper::toDto).toList());
	}

	@Override
	public ResponseEntity<com.hexlet.backend.api.model.GuestBooking> publicBookingCreateBooking(
			String slug, BookingRequest request) {
		Booking booking = bookingService.create(slug, request.getStartAt().toInstant(),
				request.getGuestName(), request.getGuestEmail(), request.getTopic());
		return ResponseEntity.status(HttpStatus.CREATED).body(BookingMapper.toGuestDto(booking));
	}
}
