package com.hexlet.backend.booking;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import com.hexlet.backend.eventtype.EventTypeRepository;
import com.hexlet.backend.schedule.ScheduleRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The main scenario over real HTTP against a running server (random port), as a client sees it:
 * status codes, content type, the {@code { message }} error format and UTC timestamps.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class BookingHttpTests {

	/** Sunday 2026-11-15 12:00 UTC; the default schedule is Mon-Fri 09:00-17:00 UTC. */
	static final Instant NOW = Instant.parse("2026-11-15T12:00:00Z");

	private static final String UTC_TIMESTAMP = "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,9})?Z";

	@TestConfiguration
	static class FixedClockConfig {
		@Bean
		@Primary
		Clock fixedClock() {
			return Clock.fixed(NOW, ZoneOffset.UTC);
		}
	}

	@Value("${local.server.port}")
	private int port;

	@Autowired
	private BookingRepository bookingRepository;

	@Autowired
	private EventTypeRepository eventTypeRepository;

	@Autowired
	private ScheduleRepository scheduleRepository;

	private final HttpClient client = HttpClient.newHttpClient();
	private final JsonMapper json = JsonMapper.builder().build();

	@BeforeEach
	void cleanDatabase() {
		bookingRepository.deleteAll();
		eventTypeRepository.deleteAll();
		// No saved schedule: the default Mon-Fri 09:00-17:00 UTC applies.
		scheduleRepository.deleteAll();
	}

	@Test
	void mainScenarioOverHttp() throws Exception {
		HttpResponse<String> created = send("POST", "/api/event-types",
				"{\"slug\": \"intro\", \"title\": \"Знакомство\", \"durationMinutes\": 30}");
		assertJson(created, 201);
		long eventTypeId = json.readTree(created.body()).get("id").asLong();

		HttpResponse<String> slotsResponse = send("GET", "/api/public/event-types/intro/slots", null);
		assertJson(slotsResponse, 200);
		JsonNode slots = json.readTree(slotsResponse.body());
		// Window 15th..28th: Mon-Fri 16-20 and 23-27, 16 half-hour slots per day.
		assertEquals(160, slots.size());
		assertEquals("2026-11-16T09:00:00Z", slots.get(0).get("startAt").asString());
		assertEquals("2026-11-16T09:30:00Z", slots.get(0).get("endAt").asString());
		assertEquals("2026-11-27T16:30:00Z", slots.get(slots.size() - 1).get("startAt").asString());
		for (JsonNode slot : slots) {
			assertTrue(slot.get("startAt").asString().matches(UTC_TIMESTAMP), slot::toString);
		}

		String booking = """
				{"startAt": "2026-11-16T09:00:00Z", "guestName": "Иван", "guestEmail": "ivan@example.com"}
				""";
		HttpResponse<String> booked = send("POST", "/api/public/event-types/intro/bookings", booking);
		assertJson(booked, 201);
		JsonNode bookingNode = json.readTree(booked.body());
		assertEquals("2026-11-16T09:00:00Z", bookingNode.get("startAt").asString());
		assertEquals("2026-11-16T09:30:00Z", bookingNode.get("endAt").asString());
		assertEquals("2026-11-15T12:00:00Z", bookingNode.get("createdAt").asString());
		assertEquals("CONFIRMED", bookingNode.get("status").asString());
		assertEquals(eventTypeId, bookingNode.get("eventTypeId").asLong());

		HttpResponse<String> bookings = send("GET", "/api/bookings", null);
		assertJson(bookings, 200);
		assertEquals(1, json.readTree(bookings.body()).size());

		// The same slot again: 409 in the { message } format, bookings unchanged.
		HttpResponse<String> repeated = send("POST", "/api/public/event-types/intro/bookings", booking);
		assertError(repeated, 409);
		assertEquals(bookings.body(), send("GET", "/api/bookings", null).body());

		// An offset in the request is normalized to UTC in the response.
		HttpResponse<String> withOffset = send("POST", "/api/public/event-types/intro/bookings", """
				{"startAt": "2026-11-16T12:30:00+03:00", "guestName": "Анна", "guestEmail": "anna@example.com"}
				""");
		assertJson(withOffset, 201);
		assertEquals("2026-11-16T09:30:00Z", json.readTree(withOffset.body()).get("startAt").asString());

		// An event type with bookings can't be deleted.
		assertError(send("DELETE", "/api/event-types/" + eventTypeId, null), 409);
	}

	@Test
	void errorsUseTheContractFormat() throws Exception {
		assertError(send("GET", "/api/public/event-types/missing", null), 404);
		assertError(send("GET", "/api/public/event-types/missing/slots", null), 404);
		assertError(send("POST", "/api/event-types", "{not json"), 400);
		assertError(send("POST", "/api/event-types",
				"{\"slug\": \"Bad Slug\", \"title\": \" \", \"durationMinutes\": 1}"), 400);
		assertError(send("PUT", "/api/schedule", "{\"timeZone\": \"+03:00\", \"intervals\": []}"), 400);
	}

	@Test
	void deletesEventTypeWithoutBookingsWithNoContent() throws Exception {
		HttpResponse<String> created = send("POST", "/api/event-types",
				"{\"slug\": \"temp\", \"title\": \"Временный\", \"durationMinutes\": 15}");
		long id = json.readTree(created.body()).get("id").asLong();

		HttpResponse<String> deleted = send("DELETE", "/api/event-types/" + id, null);
		assertEquals(204, deleted.statusCode());
		assertEquals("", deleted.body());
		assertError(send("GET", "/api/event-types/" + id, null), 404);
	}

	private HttpResponse<String> send(String method, String path, String body) throws Exception {
		HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
		if (body == null) {
			request.method(method, HttpRequest.BodyPublishers.noBody());
		} else {
			request.header("Content-Type", "application/json")
					.method(method, HttpRequest.BodyPublishers.ofString(body));
		}
		return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
	}

	private static void assertJson(HttpResponse<String> response, int expectedStatus) {
		assertEquals(expectedStatus, response.statusCode(), response::body);
		String contentType = response.headers().firstValue("Content-Type").orElse("");
		assertTrue(contentType.startsWith("application/json"), () -> "Content-Type: " + contentType);
	}

	private void assertError(HttpResponse<String> response, int expectedStatus) {
		assertJson(response, expectedStatus);
		JsonNode body = json.readTree(response.body());
		assertTrue(body.has("message") && body.get("message").isString() && !body.get("message").asString().isBlank(),
				response::body);
	}
}
