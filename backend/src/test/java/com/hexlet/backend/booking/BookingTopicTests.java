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

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Topic given by the guest when booking, through the public and owner APIs. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BookingTopicTests {

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
	void guestBooksWithTopicAndOwnerSeesIt() throws Exception {
		book("2026-11-16T09:00:00Z", "\"  Обсудить интеграцию  \"")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.topic").value("Обсудить интеграцию"))
				.andExpect(jsonPath("$.note").doesNotExist());

		mockMvc.perform(get("/api/bookings"))
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].topic").value("Обсудить интеграцию"));
	}

	@Test
	void keepsLineBreaksOfMultilineTopic() throws Exception {
		book("2026-11-16T09:00:00Z", "\" 1. Бюджет\\n2. Сроки\\n \"")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.topic").value("1. Бюджет\n2. Сроки"));
	}

	@Test
	void bookingWithoutTopicHasNoTopic() throws Exception {
		book("2026-11-16T09:00:00Z", null).andExpect(status().isCreated())
				.andExpect(jsonPath("$.topic").doesNotExist());
		book("2026-11-16T09:30:00Z", "\"\"").andExpect(status().isCreated())
				.andExpect(jsonPath("$.topic").doesNotExist());
		book("2026-11-16T10:00:00Z", "\" \\n\\t \"").andExpect(status().isCreated())
				.andExpect(jsonPath("$.topic").doesNotExist());

		mockMvc.perform(get("/api/bookings"))
				.andExpect(jsonPath("$", hasSize(3)))
				.andExpect(jsonPath("$[0].topic").doesNotExist())
				.andExpect(jsonPath("$[1].topic").doesNotExist())
				.andExpect(jsonPath("$[2].topic").doesNotExist());
	}

	@Test
	void bookingCreatedBeforeTopicsHasNoTopic() throws Exception {
		bookingRepository.save(new Booking(consultation, "Пётр", "petr@example.com",
				Instant.parse("2026-11-09T09:00:00Z"), Instant.parse("2026-11-09T09:30:00Z"),
				Instant.parse("2026-11-01T10:00:00Z")));

		mockMvc.perform(get("/api/bookings"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].guestName").value("Пётр"))
				.andExpect(jsonPath("$[0].topic").doesNotExist());
	}

	@Test
	void ownerNoteDoesNotChangeTheTopic() throws Exception {
		long id = idOf(book("2026-11-16T09:00:00Z", "\"Тема гостя\"").andExpect(status().isCreated()));

		setNote(id, "Заметка владельца")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.topic").value("Тема гостя"));
		setNote(id, "")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.note").doesNotExist())
				.andExpect(jsonPath("$.topic").value("Тема гостя"));

		mockMvc.perform(get("/api/bookings"))
				.andExpect(jsonPath("$[0].topic").value("Тема гостя"));
	}

	@Test
	void noteRequestCannotChangeTheTopic() throws Exception {
		long id = idOf(book("2026-11-16T09:00:00Z", "\"Тема гостя\"").andExpect(status().isCreated()));

		mockMvc.perform(put("/api/bookings/{id}/note", id)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"note\": \"Заметка\", \"topic\": \"Чужая тема\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.topic").value("Тема гостя"));
	}

	@Test
	void topicDoesNotAffectSlotsOrDoubleBooking() throws Exception {
		book("2026-11-16T09:00:00Z", "\"Тема\"").andExpect(status().isCreated());

		mockMvc.perform(get("/api/public/event-types/consultation/slots"))
				.andExpect(jsonPath("$", hasSize(7)))
				.andExpect(jsonPath("$[0].startAt").value("2026-11-16T09:30:00Z"));
		// The same time is taken regardless of the topic.
		book("2026-11-16T09:00:00Z", "\"Другая тема\"").andExpect(status().isConflict());
		book("2026-11-16T09:00:00Z", null).andExpect(status().isConflict());
	}

	@Test
	void acceptsTopicOfExactlyMaxLengthAfterTrimming() throws Exception {
		String topic = "a".repeat(Booking.TOPIC_MAX_LENGTH);

		book("2026-11-16T09:00:00Z", "\"   " + topic + "  \\n \"")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.topic").value(topic));
	}

	@Test
	void rejectsTooLongTopicWithoutCreatingBookingOrTakingTheSlot() throws Exception {
		book("2026-11-16T09:00:00Z", "\"" + "a".repeat(Booking.TOPIC_MAX_LENGTH + 1) + "\"")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("1000")));

		mockMvc.perform(get("/api/bookings")).andExpect(jsonPath("$", hasSize(0)));
		mockMvc.perform(get("/api/public/event-types/consultation/slots"))
				.andExpect(jsonPath("$", hasSize(8)))
				.andExpect(jsonPath("$[0].startAt").value("2026-11-16T09:00:00Z"));
		// The slot can still be booked with a valid topic.
		book("2026-11-16T09:00:00Z", "\"Короткая тема\"").andExpect(status().isCreated());
	}

	@Test
	void tooLongTopicIsRejectedBeforeCheckingTheSlot() throws Exception {
		book("2026-11-16T09:00:00Z", null).andExpect(status().isCreated());

		// The slot is taken, but the invalid topic is reported first: 400, not 409.
		book("2026-11-16T09:00:00Z", "\"" + "a".repeat(Booking.TOPIC_MAX_LENGTH + 1) + "\"")
				.andExpect(status().isBadRequest());
		// A valid topic on the taken slot still gets the usual 409.
		book("2026-11-16T09:00:00Z", "\"Тема\"").andExpect(status().isConflict());
		mockMvc.perform(get("/api/bookings")).andExpect(jsonPath("$", hasSize(1)));
	}

	/** Books consultation at the given time; topicJson is a JSON value or null to omit the field. */
	private ResultActions book(String startAt, String topicJson) throws Exception {
		String topic = topicJson == null ? "" : ", \"topic\": " + topicJson;
		return mockMvc.perform(post("/api/public/event-types/consultation/bookings")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"startAt\": \"%s\", \"guestName\": \"Иван Петров\", \"guestEmail\": \"ivan@example.com\"%s}"
						.formatted(startAt, topic)));
	}

	private ResultActions setNote(long id, String note) throws Exception {
		return mockMvc.perform(put("/api/bookings/{id}/note", id)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"note\": \"" + note + "\"}"));
	}

	private static long idOf(ResultActions result) throws Exception {
		return ((Number) JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id")).longValue();
	}
}
