package com.hexlet.backend.eventtype;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface EventTypeRepository extends JpaRepository<EventType, Long> {

	Optional<EventType> findBySlug(String slug);

	boolean existsBySlug(String slug);

	boolean existsBySlugAndIdNot(String slug, Long id);

	List<EventType> findAllByOrderByIdAsc();

	@Query("select count(b) > 0 from Booking b where b.eventType.id = :id")
	boolean hasBookings(Long id);
}
