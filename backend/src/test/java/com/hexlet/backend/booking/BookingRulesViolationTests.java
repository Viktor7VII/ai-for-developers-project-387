package com.hexlet.backend.booking;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import com.hexlet.backend.common.ConflictException;
import com.hexlet.backend.eventtype.EventType;
import com.hexlet.backend.eventtype.EventTypeRepository;
import com.hexlet.backend.schedule.Schedule;
import com.hexlet.backend.schedule.ScheduleRepository;
import com.hexlet.backend.schedule.WeeklyInterval;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Deliberate attempts to break the booking rules (spec: tickets "Conflicts", "Booking window",
 * "Slot model"; ADR-0002). Every attempt must be rejected and leave the bookings unchanged.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BookingRulesViolationTests {

	/** Sunday 2026-11-15 12:00 UTC; booking window: 15th .. 28th. */
	static final Instant NOW = Instant.parse("2026-11-15T12:00:00Z");

	private static final int THREADS = 8;

	@TestConfiguration
	static class FixedClockConfig {
		@Bean
		@Primary
		Clock fixedClock() {
			return Clock.fixed(NOW, ZoneOffset.UTC);
		}
	}

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private BookingService bookingService;

	@Autowired
	private BookingRepository bookingRepository;

	@Autowired
	private EventTypeRepository eventTypeRepository;

	@Autowired
	private ScheduleRepository scheduleRepository;

	@BeforeEach
	void setUp() {
		bookingRepository.deleteAll();
		eventTypeRepository.deleteAll();
		scheduleRepository.deleteAll();
		// Monday 09:00-11:00 UTC.
		scheduleRepository.save(new Schedule(Schedule.OWNER_SCHEDULE_ID, "UTC", List.of(
				new WeeklyInterval(DayOfWeek.MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0)))));
		eventTypeRepository.save(new EventType("consultation", "Консультация", null, 30));
		eventTypeRepository.save(new EventType("strategy", "Стратегическая сессия", null, 60));
		eventTypeRepository.save(new EventType("quarter", "Короткий звонок", null, 15));
	}

	@Test
	void concurrentRequestsForTheSameTimeOfDifferentTypesBookOnlyOne() throws Exception {
		List<Callable<Boolean>> attempts = new ArrayList<>();
		for (int i = 0; i < THREADS; i++) {
			attempts.add(i % 2 == 0
					? attempt("strategy", "2026-11-16T09:00:00Z")
					: attempt("consultation", "2026-11-16T09:00:00Z"));
		}

		assertEquals(1, countSuccesses(attempts));
		assertEquals(1, bookingRepository.count());
	}

	@Test
	void concurrentOverlappingRequestsWithDifferentStartsNeverOverlap() throws Exception {
		// All attempts start at different times, so the unique start constraint can't stop them;
		// only the lock with the in-transaction re-check does (ADR-0002). strategy 09:00-10:00
		// overlaps every other attempt; quarter 09:45-10:00 also overlaps consultation 09:30-10:00.
		// The race is probabilistic, so it is repeated.
		for (int round = 0; round < 20; round++) {
			bookingRepository.deleteAll();
			List<Callable<Boolean>> attempts = List.of(
					attempt("strategy", "2026-11-16T09:00:00Z"),
					attempt("quarter", "2026-11-16T09:15:00Z"),
					attempt("consultation", "2026-11-16T09:30:00Z"),
					attempt("quarter", "2026-11-16T09:45:00Z"));

			int successes = countSuccesses(attempts);

			List<Booking> bookings = bookingRepository.findAll();
			assertTrue(successes >= 1, "at least one attempt must succeed");
			assertEquals(successes, bookings.size());
			assertNoOverlaps(bookings);
		}
	}

	@Test
	void concurrentRequestsForAdjacentSlotsAllSucceed() throws Exception {
		// Adjacency is allowed (half-open intervals): the lock must not reject valid bookings.
		List<Callable<Boolean>> attempts = List.of(
				attempt("consultation", "2026-11-16T09:00:00Z"),
				attempt("consultation", "2026-11-16T09:30:00Z"),
				attempt("consultation", "2026-11-16T10:00:00Z"),
				attempt("consultation", "2026-11-16T10:30:00Z"));

		assertEquals(4, countSuccesses(attempts));
		assertNoOverlaps(bookingRepository.findAll());
	}

	@Test
	void rejectedBookingsLeaveTheBookingListUnchanged() throws Exception {
		book("consultation", "2026-11-16T09:00:00Z", "Иван", "ivan@example.com").andExpect(status().isCreated());
		String before = bookingsJson();

		// 409: the slot is not available.
		rejected("consultation", "2026-11-16T09:00:00Z", 409); // already booked
		rejected("strategy", "2026-11-16T09:00:00Z", 409); // overlaps a booking of another type
		rejected("consultation", "2026-11-30T09:00:00Z", 409); // outside the booking window
		rejected("consultation", "2026-11-16T09:10:00Z", 409); // not on the slot grid
		rejected("consultation", "2026-11-17T09:00:00Z", 409); // outside the schedule (Tuesday)
		rejected("strategy", "2026-11-16T10:30:00Z", 409); // does not fit into the interval
		rejected("consultation", "2026-11-09T09:00:00Z", 409); // in the past
		// 404: unknown booking link.
		rejected("unknown", "2026-11-16T09:30:00Z", 404);
		// 400: invalid guest data.
		book("consultation", "2026-11-16T09:30:00Z", " ", "ivan@example.com")
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").isString());
		book("consultation", "2026-11-16T09:30:00Z", "Иван", "not-an-email")
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").isString());

		assertEquals(before, bookingsJson());
		assertEquals(1, bookingRepository.count());
	}

	private void rejected(String slug, String startAt, int expectedStatus) throws Exception {
		String before = bookingsJson();
		book(slug, startAt, "Иван", "ivan@example.com")
				.andExpect(status().is(expectedStatus))
				.andExpect(jsonPath("$.message").isString());
		assertEquals(before, bookingsJson(), () -> "bookings changed after rejected " + slug + " at " + startAt);
	}

	private org.springframework.test.web.servlet.ResultActions book(
			String slug, String startAt, String name, String email) throws Exception {
		return mockMvc.perform(post("/api/public/event-types/{slug}/bookings", slug)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"startAt": "%s", "guestName": "%s", "guestEmail": "%s"}
						""".formatted(startAt, name, email)));
	}

	private String bookingsJson() throws Exception {
		return mockMvc.perform(get("/api/bookings"))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
	}

	private Callable<Boolean> attempt(String slug, String startAt) {
		Instant start = Instant.parse(startAt);
		return () -> {
			try {
				bookingService.create(slug, start, "Гость", "guest@example.com");
				return true;
			} catch (ConflictException e) {
				return false;
			}
		};
	}

	/** Runs all attempts at the same moment (start gate) and counts successful bookings. */
	private static int countSuccesses(List<Callable<Boolean>> attempts) throws Exception {
		CountDownLatch startGate = new CountDownLatch(1);
		List<Callable<Boolean>> gated = attempts.stream()
				.<Callable<Boolean>>map(task -> () -> {
					startGate.await();
					return task.call();
				})
				.toList();
		ExecutorService executor = Executors.newFixedThreadPool(gated.size());
		try {
			List<Future<Boolean>> results = gated.stream().map(executor::submit).toList();
			startGate.countDown();
			int successes = 0;
			for (Future<Boolean> result : results) {
				if (result.get()) {
					successes++;
				}
			}
			return successes;
		} finally {
			executor.shutdownNow();
		}
	}

	private static void assertNoOverlaps(List<Booking> bookings) {
		for (int i = 0; i < bookings.size(); i++) {
			for (int j = i + 1; j < bookings.size(); j++) {
				Booking a = bookings.get(i);
				Booking b = bookings.get(j);
				boolean overlap = a.getStartAt().isBefore(b.getEndAt()) && b.getStartAt().isBefore(a.getEndAt());
				assertTrue(!overlap, () -> "overlapping bookings: " + a.getStartAt() + " and " + b.getStartAt());
			}
		}
	}
}
