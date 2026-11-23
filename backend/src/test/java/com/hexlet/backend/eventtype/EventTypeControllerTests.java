package com.hexlet.backend.eventtype;

import java.time.Instant;

import com.hexlet.backend.booking.Booking;
import com.hexlet.backend.booking.BookingRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EventTypeControllerTests {

	private static final String CONSULTATION = """
			{"slug": "consultation", "title": "Консультация", "description": "Обсудим ваш проект", "durationMinutes": 30}
			""";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private EventTypeRepository repository;

	@Autowired
	private BookingRepository bookingRepository;

	@BeforeEach
	void cleanDatabase() {
		bookingRepository.deleteAll();
		repository.deleteAll();
	}

	@Test
	void createsEventType() throws Exception {
		mockMvc.perform(post("/api/event-types")
						.contentType(MediaType.APPLICATION_JSON)
						.content(CONSULTATION))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.slug").value("consultation"))
				.andExpect(jsonPath("$.title").value("Консультация"))
				.andExpect(jsonPath("$.description").value("Обсудим ваш проект"))
				.andExpect(jsonPath("$.durationMinutes").value(30));
	}

	@Test
	void listsEventTypes() throws Exception {
		repository.save(new EventType("intro", "Знакомство", null, 15));
		repository.save(new EventType("consultation", "Консультация", null, 30));

		mockMvc.perform(get("/api/event-types"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(2)))
				.andExpect(jsonPath("$[0].slug").value("intro"))
				.andExpect(jsonPath("$[0].description").doesNotExist())
				.andExpect(jsonPath("$[1].slug").value("consultation"));
	}

	@Test
	void getsEventTypeById() throws Exception {
		EventType saved = repository.save(new EventType("intro", "Знакомство", null, 15));

		mockMvc.perform(get("/api/event-types/{id}", saved.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(saved.getId()))
				.andExpect(jsonPath("$.title").value("Знакомство"));
	}

	@Test
	void returnsNotFoundForMissingEventType() throws Exception {
		mockMvc.perform(get("/api/event-types/{id}", 999_999))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value(containsString("999999")));
	}

	@Test
	void updatesEventType() throws Exception {
		EventType saved = repository.save(new EventType("intro", "Знакомство", "old", 15));

		mockMvc.perform(put("/api/event-types/{id}", saved.getId())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"id": 12345, "slug": "intro-call", "title": "Вводный звонок", "durationMinutes": 45}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(saved.getId()))
				.andExpect(jsonPath("$.slug").value("intro-call"))
				.andExpect(jsonPath("$.title").value("Вводный звонок"))
				.andExpect(jsonPath("$.description").doesNotExist())
				.andExpect(jsonPath("$.durationMinutes").value(45));
	}

	@Test
	void updateKeepsOwnSlug() throws Exception {
		EventType saved = repository.save(new EventType("intro", "Знакомство", null, 15));

		mockMvc.perform(put("/api/event-types/{id}", saved.getId())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"slug": "intro", "title": "Знакомство", "durationMinutes": 20}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.durationMinutes").value(20));
	}

	@Test
	void returnsNotFoundWhenUpdatingMissingEventType() throws Exception {
		mockMvc.perform(put("/api/event-types/{id}", 999_999)
						.contentType(MediaType.APPLICATION_JSON)
						.content(CONSULTATION))
				.andExpect(status().isNotFound());
	}

	@Test
	void rejectsDuplicateSlugOnCreate() throws Exception {
		repository.save(new EventType("consultation", "Другая встреча", null, 60));

		mockMvc.perform(post("/api/event-types")
						.contentType(MediaType.APPLICATION_JSON)
						.content(CONSULTATION))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value(containsString("consultation")));
	}

	@Test
	void rejectsDuplicateSlugOnUpdate() throws Exception {
		repository.save(new EventType("consultation", "Консультация", null, 30));
		EventType other = repository.save(new EventType("intro", "Знакомство", null, 15));

		mockMvc.perform(put("/api/event-types/{id}", other.getId())
						.contentType(MediaType.APPLICATION_JSON)
						.content(CONSULTATION))
				.andExpect(status().isConflict());
	}

	@Test
	void rejectsInvalidEventType() throws Exception {
		mockMvc.perform(post("/api/event-types")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"slug": "Bad Slug!", "title": " ", "durationMinutes": 1}
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("slug")))
				.andExpect(jsonPath("$.message").value(containsString("title")))
				.andExpect(jsonPath("$.message").value(containsString("durationMinutes")));
	}

	@Test
	void rejectsMissingDuration() throws Exception {
		mockMvc.perform(post("/api/event-types")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"slug": "intro", "title": "Знакомство"}
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("durationMinutes")));
	}

	@Test
	void rejectsMalformedJson() throws Exception {
		mockMvc.perform(post("/api/event-types")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{not json"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("Malformed request body"));
	}

	@Test
	void rejectsNonNumericId() throws Exception {
		mockMvc.perform(get("/api/event-types/abc"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void deletesEventTypeWithoutBookings() throws Exception {
		EventType saved = repository.save(new EventType("intro", "Знакомство", null, 15));

		mockMvc.perform(delete("/api/event-types/{id}", saved.getId()))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/event-types/{id}", saved.getId()))
				.andExpect(status().isNotFound());
		mockMvc.perform(get("/api/public/event-types/intro"))
				.andExpect(status().isNotFound());
	}

	@Test
	void refusesToDeleteEventTypeWithBookings() throws Exception {
		EventType saved = repository.save(new EventType("intro", "Знакомство", null, 15));
		// A past booking blocks deletion as well as a future one.
		Instant start = Instant.parse("2026-01-05T09:00:00Z");
		bookingRepository.save(new Booking(saved, "Гость", "guest@example.com",
				start, start.plusSeconds(15 * 60), start.minusSeconds(3600)));

		mockMvc.perform(delete("/api/event-types/{id}", saved.getId()))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value(containsString("has bookings")));

		mockMvc.perform(get("/api/event-types/{id}", saved.getId()))
				.andExpect(status().isOk());
	}

	@Test
	void returnsNotFoundWhenDeletingMissingEventType() throws Exception {
		mockMvc.perform(delete("/api/event-types/{id}", 999_999))
				.andExpect(status().isNotFound());
	}
}
