package com.hexlet.backend.booking;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface BookingRepository extends JpaRepository<Booking, Long> {

	@Query("select b from Booking b join fetch b.eventType order by b.startAt")
	List<Booking> findAllWithEventTypeOrderByStartAt();

	/** Bookings overlapping the half-open range [start, end). */
	@Query("select b from Booking b where b.startAt < :end and b.endAt > :start")
	List<Booking> findOverlapping(Instant start, Instant end);
}
