package com.hexlet.backend.schedule;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ScheduleControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ScheduleRepository repository;

	@BeforeEach
	void cleanDatabase() {
		repository.deleteAll();
	}

	@Test
	void returnsDefaultScheduleWhenNothingSaved() throws Exception {
		mockMvc.perform(get("/api/schedule"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.timeZone").value("UTC"))
				.andExpect(jsonPath("$.intervals", hasSize(5)))
				.andExpect(jsonPath("$.intervals[0].dayOfWeek").value("MONDAY"))
				.andExpect(jsonPath("$.intervals[0].startTime").value("09:00"))
				.andExpect(jsonPath("$.intervals[0].endTime").value("17:00"))
				.andExpect(jsonPath("$.intervals[4].dayOfWeek").value("FRIDAY"));
	}

	@Test
	void savesAndReturnsSortedSchedule() throws Exception {
		putSchedule("""
				{
				  "timeZone": "Europe/Moscow",
				  "intervals": [
				    {"dayOfWeek": "WEDNESDAY", "startTime": "14:00", "endTime": "18:00"},
				    {"dayOfWeek": "MONDAY", "startTime": "13:00", "endTime": "17:00"},
				    {"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "12:00"}
				  ]
				}
				""")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.timeZone").value("Europe/Moscow"))
				.andExpect(jsonPath("$.intervals", hasSize(3)))
				.andExpect(jsonPath("$.intervals[0].dayOfWeek").value("MONDAY"))
				.andExpect(jsonPath("$.intervals[0].startTime").value("09:00"))
				.andExpect(jsonPath("$.intervals[1].startTime").value("13:00"))
				.andExpect(jsonPath("$.intervals[2].dayOfWeek").value("WEDNESDAY"));

		mockMvc.perform(get("/api/schedule"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.timeZone").value("Europe/Moscow"))
				.andExpect(jsonPath("$.intervals", hasSize(3)))
				.andExpect(jsonPath("$.intervals[1].endTime").value("17:00"));
	}

	@Test
	void replacesPreviousSchedule() throws Exception {
		putSchedule("""
				{"timeZone": "UTC", "intervals": [
				  {"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "12:00"},
				  {"dayOfWeek": "TUESDAY", "startTime": "09:00", "endTime": "12:00"}
				]}
				""").andExpect(status().isOk());

		putSchedule("""
				{"timeZone": "Asia/Yekaterinburg", "intervals": [
				  {"dayOfWeek": "SATURDAY", "startTime": "10:00", "endTime": "14:30"}
				]}
				""").andExpect(status().isOk());

		mockMvc.perform(get("/api/schedule"))
				.andExpect(jsonPath("$.timeZone").value("Asia/Yekaterinburg"))
				.andExpect(jsonPath("$.intervals", hasSize(1)))
				.andExpect(jsonPath("$.intervals[0].dayOfWeek").value("SATURDAY"))
				.andExpect(jsonPath("$.intervals[0].endTime").value("14:30"));
	}

	@Test
	void allowsEmptySchedule() throws Exception {
		putSchedule("""
				{"timeZone": "UTC", "intervals": []}
				""")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.intervals", hasSize(0)));

		mockMvc.perform(get("/api/schedule"))
				.andExpect(jsonPath("$.intervals", hasSize(0)));
	}

	@Test
	void allowsAdjacentIntervals() throws Exception {
		putSchedule("""
				{"timeZone": "UTC", "intervals": [
				  {"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "12:00"},
				  {"dayOfWeek": "MONDAY", "startTime": "12:00", "endTime": "15:00"}
				]}
				""").andExpect(status().isOk());
	}

	@Test
	void rejectsOverlappingIntervals() throws Exception {
		putSchedule("""
				{"timeZone": "UTC", "intervals": [
				  {"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "12:00"},
				  {"dayOfWeek": "MONDAY", "startTime": "11:00", "endTime": "15:00"}
				]}
				""")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("overlap")));
	}

	@Test
	void rejectsIntervalWithEndBeforeStart() throws Exception {
		putSchedule("""
				{"timeZone": "UTC", "intervals": [
				  {"dayOfWeek": "MONDAY", "startTime": "12:00", "endTime": "12:00"}
				]}
				""")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("endTime")));
	}

	@Test
	void rejectsInvalidTimeFormat() throws Exception {
		putSchedule("""
				{"timeZone": "UTC", "intervals": [
				  {"dayOfWeek": "MONDAY", "startTime": "9:00", "endTime": "24:00"}
				]}
				""")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("intervals[0].startTime")))
				.andExpect(jsonPath("$.message").value(containsString("intervals[0].endTime")));
	}

	@Test
	void rejectsUnknownTimeZone() throws Exception {
		putSchedule("""
				{"timeZone": "Mars/Olympus", "intervals": []}
				""")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("timeZone")));
	}

	@Test
	void rejectsFixedOffsetTimeZones() throws Exception {
		for (String zone : new String[] {"+03:00", "UTC+3", "GMT+03:00"}) {
			putSchedule("""
					{"timeZone": "%s", "intervals": []}
					""".formatted(zone))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.message").value(containsString("IANA")));
		}
	}

	@Test
	void acceptsIanaTimeZoneIdentifiers() throws Exception {
		for (String zone : new String[] {"UTC", "Europe/Moscow", "Asia/Yekaterinburg"}) {
			putSchedule("""
					{"timeZone": "%s", "intervals": []}
					""".formatted(zone))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.timeZone").value(zone));
		}
	}

	@Test
	void rejectsMissingFields() throws Exception {
		putSchedule("""
				{"intervals": [{"dayOfWeek": "MONDAY", "startTime": "09:00"}]}
				""")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("timeZone")))
				.andExpect(jsonPath("$.message").value(containsString("intervals[0].endTime")));
	}

	@Test
	void rejectsUnknownDayOfWeek() throws Exception {
		putSchedule("""
				{"timeZone": "UTC", "intervals": [
				  {"dayOfWeek": "FUNDAY", "startTime": "09:00", "endTime": "12:00"}
				]}
				""")
				.andExpect(status().isBadRequest());
	}

	@Test
	void invalidUpdateKeepsPreviousSchedule() throws Exception {
		putSchedule("""
				{"timeZone": "Europe/Moscow", "intervals": [
				  {"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "12:00"}
				]}
				""").andExpect(status().isOk());

		putSchedule("""
				{"timeZone": "UTC", "intervals": [
				  {"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "12:00"},
				  {"dayOfWeek": "MONDAY", "startTime": "10:00", "endTime": "11:00"}
				]}
				""").andExpect(status().isBadRequest());

		mockMvc.perform(get("/api/schedule"))
				.andExpect(jsonPath("$.timeZone").value("Europe/Moscow"))
				.andExpect(jsonPath("$.intervals", hasSize(1)));
	}

	private ResultActions putSchedule(String json) throws Exception {
		return mockMvc.perform(put("/api/schedule")
				.contentType(MediaType.APPLICATION_JSON)
				.content(json));
	}
}
