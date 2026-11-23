package com.hexlet.backend.booking;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Deleting an event type vs booking it (spec #5: "либо запись создаётся, а удаление отклоняется,
 * либо удаление проходит, а создание записи отклоняется"; ADR-0002). A booking must never outlive
 * its event type.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EventTypeDeletionRaceTests {

	/** Sunday 2026-11-15 12:00 UTC; Monday 2026-11-16 09:00 is a free slot. */
	static final Instant NOW = Instant.parse("2026-11-15T12:00:00Z");

	private static final int ROUNDS = 60;

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
		scheduleRepository.save(new Schedule(Schedule.OWNER_SCHEDULE_ID, "UTC", List.of(
				new WeeklyInterval(DayOfWeek.MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0)))));
	}

	@Test
	void deletionFinishedFirstRejectsTheBooking() throws Exception {
		long id = newEventType();

		assertEquals(204, deleteEventType(id));
		assertEquals(404, book());

		assertFalse(eventTypeRepository.existsById(id));
		assertEquals(0, bookingRepository.count());
	}

	@Test
	void bookingFinishedFirstRejectsTheDeletion() throws Exception {
		long id = newEventType();

		assertEquals(201, book());
		assertEquals(409, deleteEventType(id));

		assertTrue(eventTypeRepository.existsById(id));
		assertEquals(1, bookingRepository.count());
	}

	@Test
	void concurrentDeleteAndBookingNeverLeaveABookingWithoutEventType() throws Exception {
		Map<String, Integer> outcomes = new TreeMap<>();

		for (int round = 0; round < ROUNDS; round++) {
			bookingRepository.deleteAll();
			eventTypeRepository.deleteAll();
			long id = newEventType();
			// A varying delay before the deletion makes both orders (booking first, deletion first) occur.
			long deleteDelayMillis = round % 10;

			int[] statuses = runConcurrently(
					() -> {
						Thread.sleep(deleteDelayMillis);
						return deleteEventType(id);
					},
					this::book);
			int deleteStatus = statuses[0];
			int bookingStatus = statuses[1];
			outcomes.merge("delete " + deleteStatus + " / booking " + bookingStatus, 1, Integer::sum);

			boolean typeExists = eventTypeRepository.existsById(id);
			long bookings = bookingRepository.count();
			String state = "round " + round + ": delete " + deleteStatus + ", booking " + bookingStatus
					+ ", type exists " + typeExists + ", bookings " + bookings;
			if (bookingStatus == 201) {
				// The booking won: deletion is refused and the booking keeps its event type.
				assertEquals(409, deleteStatus, state);
				assertTrue(typeExists, state);
				assertEquals(1, bookings, state);
			} else {
				// The deletion won: the booking is rejected and nothing is stored.
				assertEquals(204, deleteStatus, state);
				assertTrue(bookingStatus == 404 || bookingStatus == 409, state);
				assertFalse(typeExists, state);
				assertEquals(0, bookings, state);
			}
		}
		System.out.println("Delete/booking race outcomes over " + ROUNDS + " rounds: " + outcomes);
	}

	private long newEventType() {
		return eventTypeRepository.save(new EventType("race", "Гонка", null, 30)).getId();
	}

	private int deleteEventType(long id) throws Exception {
		return mockMvc.perform(delete("/api/event-types/{id}", id)).andReturn().getResponse().getStatus();
	}

	private int book() throws Exception {
		return mockMvc.perform(post("/api/public/event-types/race/bookings")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"startAt": "2026-11-16T09:00:00Z", "guestName": "Гость", "guestEmail": "g@example.com"}
								"""))
				.andReturn().getResponse().getStatus();
	}

	/** Starts both calls at the same moment (start gate) and returns their HTTP statuses. */
	private static int[] runConcurrently(Callable<Integer> first, Callable<Integer> second) throws Exception {
		CountDownLatch startGate = new CountDownLatch(1);
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			Future<Integer> a = executor.submit(() -> {
				startGate.await();
				return first.call();
			});
			Future<Integer> b = executor.submit(() -> {
				startGate.await();
				return second.call();
			});
			startGate.countDown();
			return new int[] {a.get(), b.get()};
		} finally {
			executor.shutdownNow();
		}
	}
}
