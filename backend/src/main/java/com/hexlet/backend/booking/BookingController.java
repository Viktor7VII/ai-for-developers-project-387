package com.hexlet.backend.booking;

import java.util.List;

import com.hexlet.backend.api.BookingsApi;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

/** Owner list of bookings, implements the generated {@link BookingsApi} (ADR-0003). */
@RestController
public class BookingController implements BookingsApi {

	private final BookingService bookingService;

	public BookingController(BookingService bookingService) {
		this.bookingService = bookingService;
	}

	@Override
	public ResponseEntity<List<com.hexlet.backend.api.model.Booking>> bookingsList() {
		return ResponseEntity.ok(bookingService.listAll().stream().map(BookingMapper::toDto).toList());
	}
}
