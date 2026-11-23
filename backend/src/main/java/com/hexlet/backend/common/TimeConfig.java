package com.hexlet.backend.common;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TimeConfig {

	/** Injected wherever "now" is needed, so tests can use a fixed clock. */
	@Bean
	public Clock clock() {
		return Clock.systemUTC();
	}
}
