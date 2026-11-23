package com.hexlet.backend.common;

import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

import org.springframework.stereotype.Component;

/**
 * The single application-wide lock that serializes changes to the owner's busy time (ADR-0002):
 * creating a booking and deleting an event type. Callers run their whole transaction inside
 * {@link #runLocked}, so the lock is released only after the transaction commits.
 */
@Component
public class BookingLock {

	private final ReentrantLock lock = new ReentrantLock();

	public <T> T runLocked(Supplier<T> action) {
		lock.lock();
		try {
			return action.get();
		} finally {
			lock.unlock();
		}
	}
}
