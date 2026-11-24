package com.hexlet.backend.booking;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;

import com.hexlet.backend.eventtype.EventType;
import com.hexlet.backend.eventtype.EventTypeRepository;
import com.hexlet.backend.schedule.Schedule;
import com.hexlet.backend.schedule.ScheduleRepository;
import com.hexlet.backend.schedule.WeeklyInterval;
import com.jayway.jsonpath.JsonPath;

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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.ResultMatcher;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Owner note to a booking through the owner API. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BookingNoteTests {

	/** Sunday 2026-11-15 12:00 UTC; the next day is Monday 2026-11-16. */
	static final Instant NOW = Instant.parse("2026-11-15T12:00:00Z");

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

	private EventType consultation;

	@BeforeEach
	void setUp() {
		bookingRepository.deleteAll();
		eventTypeRepository.deleteAll();
		scheduleRepository.deleteAll();
		// Monday 09:00-11:00 UTC.
		scheduleRepository.save(new Schedule(Schedule.OWNER_SCHEDULE_ID, "UTC", List.of(
				new WeeklyInterval(DayOfWeek.MONDAY, LocalTime.of(9, 0), LocalTime.of(11, 0)))));
		consultation = eventTypeRepository.save(new EventType("consultation", "Консультация", null, 30));
	}

	@Test
	void ownerAddsNoteToUpcomingBookingAndSeesItInTheList() throws Exception {
		long id = book("2026-11-16T09:00:00Z");

		setNote(id, "Обсудить бюджет проекта")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(id))
				.andExpect(jsonPath("$.note").value("Обсудить бюджет проекта"));

		mockMvc.perform(get("/api/bookings"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].note").value("Обсудить бюджет проекта"));
	}

	@Test
	void ownerAddsNoteToPastBooking() throws Exception {
		Booking past = bookingRepository.save(new Booking(consultation, "Пётр", "petr@example.com",
				Instant.parse("2026-11-09T09:00:00Z"), Instant.parse("2026-11-09T09:30:00Z"),
				Instant.parse("2026-11-01T10:00:00Z")));

		setNote(past.getId(), "Договорились о следующей встрече")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.note").value("Договорились о следующей встрече"));

		mockMvc.perform(get("/api/bookings"))
				.andExpect(jsonPath("$[0].note").value("Договорились о следующей встрече"));
	}

	@Test
	void bookingsWithoutNoteHaveNoNote() throws Exception {
		book("2026-11-16T09:00:00Z");
		long withNote = book("2026-11-16T09:30:00Z");
		setNote(withNote, "Есть заметка").andExpect(status().isOk());

		mockMvc.perform(get("/api/bookings"))
				.andExpect(jsonPath("$[0].note").doesNotExist())
				.andExpect(jsonPath("$[1].note").value("Есть заметка"));
	}

	@Test
	void trimsWhitespaceAroundTheNote() throws Exception {
		long id = book("2026-11-16T09:00:00Z");

		setNote(id, "  \n Тема: интеграция \t ")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.note").value("Тема: интеграция"));
	}

	@Test
	void acceptsNoteOfExactlyMaxLengthAfterTrimming() throws Exception {
		long id = book("2026-11-16T09:00:00Z");
		String note = "a".repeat(Booking.NOTE_MAX_LENGTH);

		setNote(id, "   " + note + "   ")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.note").value(note));
	}

	@Test
	void rejectsTooLongNoteAndKeepsTheSavedOne() throws Exception {
		long id = book("2026-11-16T09:00:00Z");
		setNote(id, "Прежняя заметка").andExpect(status().isOk());

		setNote(id, "a".repeat(Booking.NOTE_MAX_LENGTH + 1))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("1000")));

		mockMvc.perform(get("/api/bookings"))
				.andExpect(jsonPath("$[0].note").value("Прежняя заметка"));
	}

	@Test
	void ownerChangesExistingNote() throws Exception {
		long id = book("2026-11-16T09:00:00Z");
		setNote(id, "Прежняя заметка").andExpect(status().isOk());

		setNote(id, "  Новая заметка ")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.note").value("Новая заметка"));

		mockMvc.perform(get("/api/bookings"))
				.andExpect(jsonPath("$[0].note").value("Новая заметка"));
	}

	@Test
	void emptyOrBlankNoteRemovesTheNote() throws Exception {
		long first = book("2026-11-16T09:00:00Z");
		long second = book("2026-11-16T09:30:00Z");
		setNote(first, "Удалить пустой строкой").andExpect(status().isOk());
		setNote(second, "Удалить пробелами").andExpect(status().isOk());

		setNote(first, "")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.note").doesNotExist());
		setNote(second, " \n\t ")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.note").doesNotExist());

		mockMvc.perform(get("/api/bookings"))
				.andExpect(jsonPath("$[0].note").doesNotExist())
				.andExpect(jsonPath("$[1].note").doesNotExist());
	}

	@Test
	void returnsNotFoundForUnknownBooking() throws Exception {
		setNote(999_999, "Заметка")
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value(containsString("999999")));
	}

	@Test
	void rejectsRequestWithoutNoteField() throws Exception {
		long id = book("2026-11-16T09:00:00Z");

		mockMvc.perform(put("/api/bookings/{id}/note", id)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("note")));
	}

	@Test
	void noteDoesNotChangeTheBookingOrFreeSlots() throws Exception {
		long id = book("2026-11-16T09:00:00Z");
		String slotsBefore = mockMvc.perform(get("/api/public/event-types/consultation/slots"))
				.andReturn().getResponse().getContentAsString();

		setNote(id, "Заметка")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.guestName").value("Иван Петров"))
				.andExpect(jsonPath("$.guestEmail").value("ivan@example.com"))
				.andExpect(jsonPath("$.startAt").value("2026-11-16T09:00:00Z"))
				.andExpect(jsonPath("$.endAt").value("2026-11-16T09:30:00Z"))
				.andExpect(jsonPath("$.status").value("CONFIRMED"))
				.andExpect(jsonPath("$.createdAt").value("2026-11-15T12:00:00Z"));

		mockMvc.perform(get("/api/public/event-types/consultation/slots"))
				.andExpect(status().isOk())
				.andExpect(result -> assertEquals(slotsBefore, result.getResponse().getContentAsString()));
		// The booked slot stays taken.
		book("2026-11-16T09:00:00Z", status().isConflict());
	}

	private long book(String startAt) throws Exception {
		String body = book(startAt, status().isCreated()).andReturn().getResponse().getContentAsString();
		return ((Number) JsonPath.read(body, "$.id")).longValue();
	}

	private ResultActions book(String startAt, ResultMatcher expectedStatus) throws Exception {
		return mockMvc.perform(post("/api/public/event-types/consultation/bookings")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"startAt": "%s", "guestName": "Иван Петров", "guestEmail": "ivan@example.com"}
								""".formatted(startAt)))
				.andExpect(expectedStatus);
	}

	private ResultActions setNote(long id, String note) throws Exception {
		return mockMvc.perform(put("/api/bookings/{id}/note", id)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"note\": " + toJsonString(note) + "}"));
	}

	/** JSON string literal for the characters used in these tests. */
	private static String toJsonString(String value) {
		StringBuilder json = new StringBuilder("\"");
		for (char c : value.toCharArray()) {
			switch (c) {
				case '"' -> json.append("\\\"");
				case '\\' -> json.append("\\\\");
				case '\n' -> json.append("\\n");
				case '\t' -> json.append("\\t");
				default -> json.append(c);
			}
		}
		return json.append('"').toString();
	}
}
